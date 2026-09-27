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

export interface EmailSignature {
  display_name: string;
  job_title: string;
  phone: string;
  body_text: string;
  image_url: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Corpo HTML profissional: texto + link + assinatura do operador. */
export function buildEmailHtml(body: string, link: string, appUrl: string, sig: EmailSignature | null): string {
  const url = link && appUrl ? `${appUrl}${link}` : link;
  const paras = body.split(/\n{2,}|\n/).filter((p) => p.trim()).map((p) => `<p>${esc(p.trim())}</p>`).join("");
  const open = url ? `<p><a href="${esc(url)}">Abrir no sistema</a></p>` : "";
  let signature = "";
  if (sig && (sig.display_name || sig.body_text)) {
    const img = sig.image_url ? `<img src="${esc(sig.image_url)}" alt="" width="160" style="max-width:160px;height:auto;" />` : "";
    signature = [
      `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />`,
      img,
      sig.display_name ? `<p><strong>${esc(sig.display_name)}</strong>${sig.job_title ? ` — ${esc(sig.job_title)}` : ""}</p>` : "",
      sig.phone ? `<p>${esc(sig.phone)}</p>` : "",
      sig.body_text ? `<p>${esc(sig.body_text)}</p>` : "",
    ].join("");
  }
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">${paras}${open}${signature}</div>`;
}
