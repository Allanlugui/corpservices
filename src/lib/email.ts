import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "./supabase-admin";
import type { EmailConfig, SmtpConfig } from "./email-config";

export type { EmailConfig, EmailSignature } from "./email-config";
export { buildEmailBody, buildEmailHtml, resolveEmailConfig, resolveSmtpConfig } from "./email-config";

export interface EmailInput {
  userId: string;
  kind: string;
  subject: string;
  body?: string;
  link?: string;
}

/** Enfileira e-mail ao usuário (resolve e-mail via Auth; SKIPPED sem e-mail). */
export async function enqueueEmail(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  input: EmailInput,
  senderUserId?: string,
): Promise<void> {
  let to = "";
  try {
    const { data } = await admin.auth.admin.getUserById(input.userId);
    to = data?.user?.email ?? "";
  } catch {
    to = "";
  }
  await admin.from("email_queue").insert({
    org_id: orgId,
    user_id: input.userId,
    sender_user_id: senderUserId ?? null,
    to_email: to,
    subject: input.subject,
    body_text: input.body ?? "",
    kind: input.kind,
    link: input.link ?? null,
    status: to ? "PENDING" : "SKIPPED",
    last_error: to ? null : "usuario sem e-mail no Auth",
  });
}

/** Envio via SMTP (Gmail/app password). Retorna erro textual ou null. */
export async function sendViaSmtp(cfg: SmtpConfig, from: string, to: string, subject: string, text: string, html?: string): Promise<string | null> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : "falha smtp";
  }
}

/** Legado Resend (mantido p/ compat; provedor atual é smtp). */
export async function sendViaResend(apiKey: string, from: string, to: string, subject: string, text: string, html?: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return `resend ${res.status}: ${detail.slice(0, 200)}`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : "falha de rede";
  }
}
