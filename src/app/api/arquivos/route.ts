import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const OWNER_TABLE: Record<string, string> = {
  work_order: "work_orders",
  ticket: "tickets",
  purchase: "purchase_requests",
  product: "products",
};

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf", "text/xml", "application/xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_BYTES = 10 * 1024 * 1024;

async function ownerOrgId(admin: ReturnType<typeof createAdminClient>, ownerType: string, ownerId: string): Promise<string | null> {
  if (ownerType === "checklist_item") {
    const { data: item } = await admin.from("work_order_checklists").select("work_order_id").eq("id", ownerId).single();
    if (!item) return null;
    const { data: wo } = await admin.from("work_orders").select("org_id").eq("id", item.work_order_id).single();
    return (wo?.org_id as string) ?? null;
  }
  const table = OWNER_TABLE[ownerType];
  if (!table) return null;
  const { data } = await admin.from(table).select("org_id").eq("id", ownerId).single();
  return (data?.org_id as string) ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "files", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const ownerType = url.searchParams.get("owner_type") ?? "";
    const ownerId = url.searchParams.get("owner_id") ?? "";
    if (!OWNER_TABLE[ownerType] && ownerType !== "checklist_item") {
      return fail("VALIDATION", "owner invalido.", 422);
    }
    const admin = createAdminClient();
    const { data: files } = await admin
      .from("files")
      .select("id, owner_type, owner_id, folder, path, name, mime, size_bytes, created_at")
      .eq("org_id", session.orgId)
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    const withUrls = await Promise.all(
      (files ?? []).map(async (f) => {
        const { data } = await admin.storage.from("attachments").createSignedUrl(f.path as string, 3600);
        return { ...f, url: data?.signedUrl ?? null };
      }),
    );
    return ok({ files: withUrls });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "files", "update") && !can(session.role, "files", "create")) {
      // files:* cobre; update/create granular quando existirem.
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const form = await request.formData();
    const file = form.get("file");
    const ownerType = String(form.get("owner_type") ?? "");
    const ownerId = String(form.get("owner_id") ?? "");
    const folder = String(form.get("folder") ?? "documentos");
    if (!(file instanceof File)) return fail("VALIDATION", "Arquivo ausente.", 422);
    if (!ALLOWED_MIME.has(file.type)) return fail("INVALID_TYPE", `Tipo nao permitido: ${file.type || "desconhecido"}.`, 422);
    if (file.size <= 0 || file.size > MAX_BYTES) return fail("INVALID_SIZE", "Arquivo vazio ou maior que 10MB.", 422);
    if (!z.string().uuid().safeParse(ownerId).success) return fail("VALIDATION", "owner invalido.", 422);

    const admin = createAdminClient();
    const orgId = await ownerOrgId(admin, ownerType, ownerId);
    if (!orgId || orgId !== session.orgId) return fail("NOT_FOUND", "Destino nao encontrado.", 404);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `${orgId}/${ownerType}/${ownerId}/${folder}/${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upError } = await admin.storage.from("attachments").upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upError) return fail("UPLOAD", "Falha no upload.", 500);
    const { data: row, error: dbError } = await admin
      .from("files")
      .insert({
        org_id: orgId,
        owner_type: ownerType,
        owner_id: ownerId,
        folder,
        path,
        name: file.name.slice(0, 160),
        mime: file.type,
        size_bytes: file.size,
        uploaded_by: session.userId,
      })
      .select("id")
      .single();
    if (dbError || !row) {
      await admin.storage.from("attachments").remove([path]);
      return fail("DB_INSERT", "Falha ao registrar.", 500);
    }
    return ok({ id: row.id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "files", "delete")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    if (!z.string().uuid().safeParse(id).success) return fail("VALIDATION", "id invalido.", 422);
    const admin = createAdminClient();
    const { data: row } = await admin.from("files").select("id, path").eq("id", id).eq("org_id", session.orgId).single();
    if (!row) return fail("NOT_FOUND", "Arquivo nao encontrado.", 404);
    await admin.storage.from("attachments").remove([row.path as string]);
    await admin.from("files").delete().eq("id", id);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
