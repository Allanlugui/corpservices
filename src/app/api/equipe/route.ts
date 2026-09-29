import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { ROLES } from "@/domain/rbac";
import { enqueueEmail } from "@/lib/email";

function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

/** Equipe: lista com perfil completo + permissões explícitas. Admin/gestor. */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("profiles")
      .select("id, display_name, role_key, department, position, phone, avatar_url, must_reset, created_at")
      .eq("org_id", session.orgId)
      .order("display_name");
    const { data: perms } = await admin.from("user_permissions").select("user_id, module, action, allowed").eq("org_id", session.orgId);
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 });
    const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const bannedById = new Map((users?.users ?? []).map((u) => [u.id, Boolean(u.banned_until)]));
    return ok({
      members: (members ?? []).map((m) => ({
        ...(m as Record<string, unknown>),
        email: emailById.get((m as { id: string }).id) ?? "",
        banned: bannedById.get((m as { id: string }).id) ?? false,
        permissions: (perms ?? []).filter((p) => (p as { user_id: string }).user_id === (m as { id: string }).id),
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

const inviteSchema = z.object({
  email: z.string().email().max(160),
  display_name: z.string().trim().min(2).max(120),
  role_key: z.enum(ROLES),
  department: z.string().trim().max(120).default(""),
  position: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(30).default(""),
});

/**
 * Convite: cria login + perfil + senha provisória enviada por e-mail.
 * O primeiro acesso exige troca (must_reset).
 */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Dados do convite invalidos.", 422);
    if (parsed.data.role_key === "admin" && session.role !== "admin") {
      return fail("FORBIDDEN", "Só admin convida admin.", 403);
    }
    const admin = createAdminClient();
    const password = tempPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) return fail("INVITE", createErr?.message ?? "Nao foi possivel criar.", 422);
    const uid = created.user.id;
    const { error: profErr } = await admin.from("profiles").upsert({
      id: uid,
      org_id: session.orgId,
      role_key: parsed.data.role_key,
      display_name: parsed.data.display_name,
      department: parsed.data.department,
      position: parsed.data.position,
      phone: parsed.data.phone.replace(/\D/g, ""),
      must_reset: true,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(uid);
      return fail("DB_ERROR", "Nao foi possivel criar o perfil.", 500);
    }
    await enqueueEmail(admin, session.orgId, {
      userId: uid,
      kind: "boas_vindas",
      subject: "Seu acesso ao CorpServices",
      body: `Olá ${parsed.data.display_name}. Seu acesso: ${parsed.data.email} / senha provisória ${password}. Troque no primeiro acesso.`,
      link: "/login",
    }, session.userId);
    return ok({ id: uid }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
