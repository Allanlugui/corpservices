import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { pushConfigured, sendPushToUser } from "@/lib/push";

const subSchema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** Inscrição do dispositivo para push (usuário autenticado, próprio userId). */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!pushConfigured()) return fail("PUSH_DISABLED", "Push nao configurado (VAPID).", 422);
    const parsed = subSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Inscricao invalida.", 422);
    const admin = createAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert({
      org_id: session.orgId,
      user_id: session.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    }, { onConflict: "user_id,endpoint" });
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Remove inscrição do dispositivo. */
export async function DELETE(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = z.object({ endpoint: z.string().url().max(500) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Endpoint invalido.", 422);
    const admin = createAdminClient();
    await admin.from("push_subscriptions").delete().eq("user_id", session.userId).eq("endpoint", parsed.data.endpoint);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Teste: envia push aos próprios dispositivos. */
export async function PUT() {
  try {
    const session = await requireProfile();
    if (!pushConfigured()) return fail("PUSH_DISABLED", "Push nao configurado (VAPID).", 422);
    const admin = createAdminClient();
    const result = await sendPushToUser(admin, session.userId, {
      title: "CorpServices — push de teste",
      body: "Notificações push operacionais.",
      link: "/",
    });
    return ok(result);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
