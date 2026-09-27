import "server-only";
import { createAdminClient } from "./supabase-admin";
import type { EmailConfig } from "./email-config";

export type { EmailConfig };
export type { EmailSignature } from "./email-config";
export { buildEmailBody, buildEmailHtml, resolveEmailConfig } from "./email-config";

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
    to_email: to,
    subject: input.subject,
    body_text: input.body ?? "",
    kind: input.kind,
    link: input.link ?? null,
    status: to ? "PENDING" : "SKIPPED",
    last_error: to ? null : "usuario sem e-mail no Auth",
  });
}

/** Envio via Resend HTTP (sem SDK). Retorna erro textual ou null. */
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
