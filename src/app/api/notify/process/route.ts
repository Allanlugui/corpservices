import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { buildEmailBody, buildEmailHtml, resolveEmailConfig, resolveSmtpConfig, sendViaSmtp } from "@/lib/email";
import { getSetting } from "../../configuracoes/route";

const BATCH = 20;
const MAX_ATTEMPTS = 5;

/**
 * Worker da fila de e-mail (Fase 13). Sem cron contratado: disparo manual
 * (botão em Configurações) ou via agendador externo com CRON_SECRET.
 */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "read")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const admin = createAdminClient();
    const { data } = await admin.from("email_queue").select("status").eq("org_id", session.orgId);
    const counts: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const r of data ?? []) counts[(r as { status: string }).status] = (counts[(r as { status: string }).status] ?? 0) + 1;
    const cfg = resolveEmailConfig(process.env);
    return ok({ counts, provider: cfg.provider, configured: cfg.enabled });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    // Agendador externo pode chamar com CRON_SECRET sem sessão.
    const cron = request.headers.get("x-cron-secret");
    let orgScope: string | null = null;
    if (!cron || cron !== process.env.CRON_SECRET) {
      const session = await requireProfile();
      if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Sem permissao.", 403);
      orgScope = session.orgId;
    }
    const parsed = z.object({ test_email: z.string().email().max(160).optional() }).safeParse(await request.json().catch(() => ({})));
    const admin = createAdminClient();
    const cfg = resolveEmailConfig(process.env);
    const smtp = resolveSmtpConfig(process.env);
    if (!cfg.enabled || !smtp) return fail("EMAIL_DISABLED", "SMTP nao configurado (SMTP_USER + SMTP_PASS).", 422);

    // Teste: envia direto sem fila.
    if (parsed.success && parsed.data.test_email) {
      const err = await sendViaSmtp(smtp, cfg.from, parsed.data.test_email, "CorpServices — e-mail de teste", "Provedor configurado e operacional.");
      if (err) return fail("EMAIL_SEND", err, 502);
      return ok({ sent: 1, test: true });
    }

    let query = admin.from("email_queue").select("*").eq("status", "PENDING").lt("attempts", MAX_ATTEMPTS).order("created_at").limit(BATCH);
    if (orgScope) query = query.eq("org_id", orgScope);
    const { data: pending } = await query;
    let sent = 0;
    const failed: string[] = [];
    let skippedOrg = 0;
    for (const m of pending ?? []) {
      const row = m as { id: string; org_id: string; user_id: string | null; sender_user_id: string | null; to_email: string; subject: string; body_text: string; link: string | null; attempts: number };
      // Respeita o kill-switch por org (email_enabled).
      const enabled = await getSetting(admin, row.org_id, "email_enabled");
      if (enabled !== 1) {
        skippedOrg += 1;
        continue;
      }
      // Assinatura de quem DISPAROU (gestor do convite/aprovação/reset).
      let sig: { display_name: string; job_title: string; phone: string; body_text: string; image_url: string | null } | null = null;
      if (row.sender_user_id) {
        const { data: s } = await admin.from("email_signatures").select("display_name, job_title, phone, body_text, image_url").eq("org_id", row.org_id).eq("user_id", row.sender_user_id).maybeSingle();
        sig = (s as typeof sig) ?? null;
      }
      const text = buildEmailBody(row.body_text, row.link ?? "", cfg.appUrl);
      const html = buildEmailHtml(row.body_text, row.link ?? "", cfg.appUrl, sig);
      const err = await sendViaSmtp(smtp, cfg.from, row.to_email, row.subject, text, html);
      if (err) {
        failed.push(row.id);
        await admin.from("email_queue").update({ status: row.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", attempts: row.attempts + 1, last_error: err }).eq("id", row.id);
      } else {
        sent += 1;
        await admin.from("email_queue").update({ status: "SENT", attempts: row.attempts + 1, sent_at: new Date().toISOString() }).eq("id", row.id);
      }
    }
    return ok({ sent, failed: failed.length, skippedOrg, provider: cfg.provider });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
