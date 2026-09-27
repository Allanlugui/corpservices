import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const parsed = z.object({
      name: z.string().trim().min(1).max(160).optional(),
      doc: z.string().trim().max(30).nullable().optional(),
      contact: z.string().trim().max(200).nullable().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin.from("suppliers").update(parsed.data).eq("id", id).eq("org_id", session.orgId).select("id").single();
    if (error || !data) return fail("NOT_FOUND", "Fornecedor nao encontrado.", 404);
    return ok({ id: data.id });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", id).eq("org_id", session.orgId);
    if ((count ?? 0) > 0) {
      return fail("IN_USE", "Fornecedor vinculado a produtos; não pode ser excluído.", 422);
    }
    const { error } = await admin.from("suppliers").delete().eq("id", id).eq("org_id", session.orgId);
    if (error) return fail("NOT_FOUND", "Fornecedor nao encontrado.", 404);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
