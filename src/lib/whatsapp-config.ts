/** WhatsApp via Meta Cloud API. Puro e testável (sem server-only). */

export interface WhatsConfig {
  enabled: boolean;
  token: string;
  phoneId: string;
  template: string;
  lang: string;
}

export function resolveWhatsConfig(env: Record<string, string | undefined>): WhatsConfig {
  const token = env.WHATSAPP_TOKEN ?? "";
  const phoneId = env.WHATSAPP_PHONE_ID ?? "";
  return {
    enabled: Boolean(token && phoneId),
    token,
    phoneId,
    template: env.WHATSAPP_TEMPLATE ?? "hello_world",
    lang: env.WHATSAPP_LANG ?? "pt_BR",
  };
}

/**
 * Normaliza para E.164. Brasil por padrão: "11999999999" → "55119999999999".
 * Retorna "" quando inválido (fila marca SKIPPED, nunca envia errado).
 */
export function formatPhone(raw: string, defaultCountry = "55"): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+")) return digits.length >= 10 && digits.length <= 15 ? digits : "";
  const withCountry = digits.startsWith(defaultCountry) ? digits : defaultCountry + digits;
  return withCountry.length >= 12 && withCountry.length <= 15 ? withCountry : "";
}
