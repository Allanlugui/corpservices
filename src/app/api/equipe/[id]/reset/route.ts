import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { enqueueEmail } from "@/lib/email";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Reset pelo gestor (sem autoatendimento): gera token próprio de 2h e
 * envia o link pelo nosso e-mail (Resend). Sem SMTP do Supabase,
 * sem redirect externo.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const { id } = paramsSchema.parse(await params);
    if (id === session.userId) return fail("VALIDATION", "Use Meu perfil para trocar a sua.", 422);
    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("id, display_name, role_key").eq("id", id).eq("org_id", session.orgId).maybeSingle();
    if (!target) return fail("NOT_FOUND", "Membro nao encontrado.", 404);
    if ((target as { role_key: string }).role_key === "admin" && session.role !== "admin") {
      return fail("FORBIDDEN", "Só admin reseta admin.", 403);
    }
    const token = `${randomBytes(24).toString("base64url")}.${randomBytes(8).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    // Invalida tokens anteriores do usuário.
    await admin.from("password_resets").delete().eq("user_id", id).is("used_at", null);
    const { error } = await admin.from("password_resets").insert({
      org_id: session.orgId,
      user_id: id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    if (error) return fail("DB_ERROR", "Nao foi possivel gerar.", 500);
    await enqueueEmail(admin, session.orgId, {
      userId: id,
      kind: "reset_senha",
      subject: "Restaure seu acesso ao CorpServices",
      body: `Olá ${(target as { display_name: string }).display_name ?? "usuário"}. Use o link abaixo para criar uma nova senha (vale 2h, uso único).`,
      link: `/atualizar-senha?token=${token}`,
    });
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
