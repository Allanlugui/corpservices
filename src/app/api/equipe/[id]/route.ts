import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { MODULES, ROLES, type Action } from "@/domain/rbac";

const paramsSchema = z.object({ id: z.string().uuid() });

async function guard(session: Awaited<ReturnType<typeof requireProfile>>, admin: ReturnType<typeof createAdminClient>, id: string) {
  if (!canSession(session, "settings", "update")) return "Somente admin/gestor.";
  const { data: target } = await admin.from("profiles").select("id, role_key").eq("id", id).eq("org_id", session.orgId).maybeSingle();
  if (!target) return "Membro nao encontrado.";
  if ((target as { role_key: string }).role_key === "admin" && session.role !== "admin") return "Só admin altera admin.";
  if (id === session.userId) return "Use Meu perfil para alterar você mesmo.";
  return null;
}

/** Atualiza papel, setor, cargo, telefone e overlay de permissões. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const blocked = await guard(session, admin, id);
    if (blocked) return fail("FORBIDDEN", blocked, 403);
    const parsed = z.object({
      role_key: z.enum(ROLES).optional(),
      department: z.string().trim().max(120).optional(),
      position: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      permissions: z.array(z.object({ module: z.enum(MODULES), action: z.string().max(20), allowed: z.boolean() })).max(64).optional(),
      must_reset: z.boolean().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const d = parsed.data;
    if (d.role_key === "admin" && session.role !== "admin") return fail("FORBIDDEN", "Só admin promove a admin.", 403);
    const patch: Record<string, unknown> = {};
    if (d.role_key) patch.role_key = d.role_key;
    if (d.department !== undefined) patch.department = d.department;
    if (d.position !== undefined) patch.position = d.position;
    if (d.phone !== undefined) patch.phone = d.phone.replace(/\D/g, "");
    if (d.must_reset !== undefined) patch.must_reset = d.must_reset;
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("profiles").update(patch).eq("id", id);
      if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    }
    if (d.permissions) {
      await admin.from("user_permissions").delete().eq("org_id", session.orgId).eq("user_id", id);
      const rows = d.permissions.map((p) => ({ org_id: session.orgId, user_id: id, module: p.module, action: p.action as Action, allowed: p.allowed }));
      if (rows.length > 0) {
        const { error } = await admin.from("user_permissions").insert(rows);
        if (error) return fail("DB_ERROR", "Permissoes invalidas.", 500);
      }
    }
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Desativa (ban no Auth; perfil e histórico preservados). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const blocked = await guard(session, admin, id);
    if (blocked) return fail("FORBIDDEN", blocked, 403);
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (error) return fail("DB_ERROR", "Nao foi possivel desativar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Reativa (remove ban). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    const { id } = paramsSchema.parse(await params);
    const parsed = z.object({ action: z.literal("unban") }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Acao invalida.", 422);
    const admin = createAdminClient();
    const blocked = await guard(session, admin, id);
    if (blocked) return fail("FORBIDDEN", blocked, 403);
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return fail("DB_ERROR", "Nao foi possivel reativar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
