import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const { id } = paramsSchema.parse(await params);
    const parsed = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      active: z.boolean().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const admin = createAdminClient();
    const { error } = await admin.from("locations").update(parsed.data).eq("id", id).eq("org_id", session.orgId);
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { error } = await admin.from("locations").delete().eq("id", id).eq("org_id", session.orgId);
    if (error) return fail("DB_ERROR", "Local com filhos ou em uso?", 422);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
