/** Config de e-mail pura (sem server-only: testável em vitest). */

export interface EmailConfig {
  enabled: boolean;
  provider: "resend" | "disabled";
  from: string;
  appUrl: string;
}

/** Chave SOMENTE via env; sem chave = disabled (honesto). */
export function resolveEmailConfig(env: Record<string, string | undefined>): EmailConfig {
  const from = env.EMAIL_FROM ?? "CorpServices <nao-responder@localhost>";
  const appUrl = env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? "";
  if (!env.RESEND_API_KEY) return { enabled: false, provider: "disabled", from, appUrl };
  return { enabled: true, provider: "resend", from, appUrl };
}

export function buildEmailBody(body: string, link: string, appUrl: string): string {
  const url = link && appUrl ? `${appUrl}${link}` : link;
  return url ? `${body}\n\nAbrir no sistema: ${url}` : body;
}
