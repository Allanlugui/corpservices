import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { formatPhone, resolveWhatsConfig } from "@/lib/whatsapp-config";
import { sendViaMeta } from "@/lib/whatsapp";

const BATCH = 20;
const MAX_ATTEMPTS = 5;

/**
 * Worker da fila de WhatsApp (Fase 18, Meta Cloud API).
 * Proativo exige template aprovado; sem credencial = disabled honesto.
 */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "read")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const admin = createAdminClient();
    const { data } = await admin.from("whatsapp_queue").select("status").eq("org_id", session.orgId);
    const counts: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const r of data ?? []) counts[(r as { status: string }).status] = (counts[(r as { status: string }).status] ?? 0) + 1;
    const cfg = resolveWhatsConfig(process.env);
    return ok({ counts, configured: cfg.enabled, template: cfg.template });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const parsed = z.object({ test_phone: z.string().max(30).optional() }).safeParse(await request.json().catch(() => ({})));
    const admin = createAdminClient();
    const cfg = resolveWhatsConfig(process.env);
    if (!cfg.enabled) return fail("WHATS_DISABLED", "WhatsApp nao configurado (WHATSAPP_TOKEN + WHATSAPP_PHONE_ID).", 422);

    if (parsed.success && parsed.data.test_phone) {
      const to = formatPhone(parsed.data.test_phone);
      if (!to) return fail("VALIDATION", "Telefone invalido (use DDD+numero).", 422);
      const err = await sendViaMeta(cfg.token, cfg.phoneId, cfg.template, cfg.lang, to, "teste");
      if (err) return fail("WHATS_SEND", err, 502);
      return ok({ sent: 1, test: true });
    }

    const { data: pending } = await admin
      .from("whatsapp_queue")
      .select("*")
      .eq("org_id", session.orgId)
      .eq("status", "PENDING")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at")
      .limit(BATCH);
    let sent = 0;
    let failed = 0;
    for (const m of pending ?? []) {
      const row = m as { id: string; to_phone: string; body: string; attempts: number };
      const err = await sendViaMeta(cfg.token, cfg.phoneId, cfg.template, cfg.lang, row.to_phone, row.body);
      if (err) {
        failed += 1;
        await admin.from("whatsapp_queue").update({ status: row.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", attempts: row.attempts + 1, last_error: err }).eq("id", row.id);
      } else {
        sent += 1;
        await admin.from("whatsapp_queue").update({ status: "SENT", attempts: row.attempts + 1, sent_at: new Date().toISOString() }).eq("id", row.id);
      }
    }
    return ok({ sent, failed });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Telefone próprio para receber avisos (somente o dono edita). */
export async function PUT(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = z.object({ phone: z.string().max(30) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Telefone invalido.", 422);
    const phone = formatPhone(parsed.data.phone);
    if (!phone) return fail("VALIDATION", "Telefone invalido (use DDD+numero).", 422);
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ phone }).eq("id", session.userId);
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    return ok({ phone });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
