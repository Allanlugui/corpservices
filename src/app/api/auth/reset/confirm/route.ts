import { z } from "zod";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";

/** Confirma reset do gestor: token próprio (2h, uso único). Sem login. */
export async function POST(request: Request) {
  const parsed = z.object({
    token: z.string().min(20).max(200),
    password: z.string().min(8).max(200),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Link inválido ou senha curta (mín. 8).", 422);
  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const { data: row } = await admin
    .from("password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  const rec = row as { id: string; user_id: string; expires_at: string; used_at: string | null } | null;
  if (!rec || rec.used_at || Date.parse(rec.expires_at) < Date.now()) {
    return fail("INVALID_TOKEN", "Link inválido, expirado ou já usado. Peça outro ao gestor.", 422);
  }
  const { error } = await admin.auth.admin.updateUserById(rec.user_id, { password: parsed.data.password });
  if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
  await admin.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", rec.id);
  await admin.from("profiles").update({ must_reset: false }).eq("id", rec.user_id);
  return ok({ ok: true });
}
