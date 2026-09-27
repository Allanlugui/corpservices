import "server-only";
import { createAdminClient } from "./supabase-admin";
import { formatPhone, resolveWhatsConfig } from "./whatsapp-config";

export interface WhatsInput {
  userId: string;
  kind: string;
  body: string;
  link?: string;
}

/** Enfileira WhatsApp (telefone em profiles.phone; SKIPPED sem número). */
export async function enqueueWhats(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  input: WhatsInput,
): Promise<void> {
  let phone = "";
  try {
    const { data } = await admin.from("profiles").select("phone").eq("id", input.userId).maybeSingle();
    phone = formatPhone((data as { phone?: string } | null)?.phone ?? "");
  } catch {
    phone = "";
  }
  await admin.from("whatsapp_queue").insert({
    org_id: orgId,
    user_id: input.userId,
    to_phone: phone,
    body: input.body,
    kind: input.kind,
    link: input.link ?? null,
    status: phone ? "PENDING" : "SKIPPED",
    last_error: phone ? null : "usuario sem telefone cadastrado",
  });
}

/** Envio via template da Meta Cloud API. Retorna erro textual ou null. */
export async function sendViaMeta(
  token: string,
  phoneId: string,
  template: string,
  lang: string,
  to: string,
  bodyFallback: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template, language: { code: lang } },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return `meta ${res.status}: ${detail.slice(0, 200)} (texto seria: ${bodyFallback.slice(0, 80)})`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : "falha de rede";
  }
}

export { resolveWhatsConfig };
