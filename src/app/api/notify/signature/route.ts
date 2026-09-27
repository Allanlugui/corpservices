import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

const fieldsSchema = z.object({
  display_name: z.string().trim().max(120).default(""),
  job_title: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  body_text: z.string().trim().max(1000).default(""),
});

/** Assinatura do operador para os e-mails disparados por ele. Leitura/escrita: próprio usuário. */
export async function GET() {
  try {
    const session = await requireProfile();
    const admin = createAdminClient();
    const { data } = await admin.from("email_signatures").select("*").eq("org_id", session.orgId).eq("user_id", session.userId).maybeSingle();
    return ok({ signature: data ?? null });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = fieldsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { error } = await admin.from("email_signatures").upsert({
      org_id: session.orgId,
      user_id: session.userId,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Imagem da assinatura (png/jpg/webp ≤ 1MB) → bucket público. */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    const form = await request.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File)) return fail("VALIDATION", "Imagem ausente.", 422);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return fail("FILE_TYPE", "Use PNG, JPG ou WEBP.", 422);
    if (file.size > 1_048_576) return fail("FILE_SIZE", "Máximo 1 MB.", 422);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `assinaturas/${session.orgId}/${session.userId}.${ext}`;
    const admin = createAdminClient();
    // Remove versão anterior (outra extensão) antes do upsert.
    for (const e of ["png", "jpg", "webp"]) {
      await admin.storage.from("public-assets").remove([`assinaturas/${session.orgId}/${session.userId}.${e}`]);
    }
    const { error: upErr } = await admin.storage.from("public-assets").upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) return fail("UPLOAD", "Nao foi possivel enviar.", 500);
    const { data } = admin.storage.from("public-assets").getPublicUrl(path);
    await admin.from("email_signatures").upsert({
      org_id: session.orgId,
      user_id: session.userId,
      image_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    });
    return ok({ image_url: data.publicUrl });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
