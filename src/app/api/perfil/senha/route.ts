import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

function anonClient() {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");
}

/**
 * Troca de senha com confirmação da atual + limpeza do must_reset
 * (primeiro acesso com senha provisória).
 */
export async function PUT(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = z.object({
      current: z.string().min(1).max(200),
      next: z.string().min(8).max(200),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Senha atual incorreta ou nova senha curta (mín. 8).", 422);
    const anon = anonClient();
    const { error: signErr } = await anon.auth.signInWithPassword({ email: session.email, password: parsed.data.current });
    if (signErr) return fail("AUTH", "Senha atual incorreta.", 401);
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(session.userId, { password: parsed.data.next });
    if (error) return fail("DB_ERROR", "Nao foi possivel trocar.", 500);
    await admin.from("profiles").update({ must_reset: false }).eq("id", session.userId);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
