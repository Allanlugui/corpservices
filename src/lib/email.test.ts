import { describe, expect, it } from "vitest";
import { buildEmailBody, buildEmailHtml, resolveEmailConfig } from "./email-config";

describe("email", () => {
  it("disabled sem RESEND_API_KEY (honesto)", () => {
    expect(resolveEmailConfig({}).provider).toBe("disabled");
    expect(resolveEmailConfig({}).enabled).toBe(false);
  });

  it("resend ativo com chave", () => {
    const cfg = resolveEmailConfig({ RESEND_API_KEY: "re_test", EMAIL_FROM: "a@b.com", APP_URL: "https://x" });
    expect(cfg.provider).toBe("resend");
    expect(cfg.enabled).toBe(true);
    expect(cfg.from).toBe("a@b.com");
  });

  it("corpo inclui link absoluto quando ha appUrl", () => {
    const body = buildEmailBody("Compra aprovada", "/compras/1", "https://app.ex");
    expect(body).toContain("https://app.ex/compras/1");
  });

  it("corpo sem link quando ausente", () => {
    expect(buildEmailBody("Oi", "", "")).toBe("Oi");
  });

  it("html escapa texto e monta assinatura", () => {
    const html = buildEmailHtml("Olá <b>João</b>", "/compras/1", "https://app.ex", {
      display_name: "Maria",
      job_title: "Compradora",
      phone: "(11) 9999",
      body_text: "CorpServices",
      image_url: "https://img/logo.png",
    });
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("Maria");
    expect(html).toContain("https://img/logo.png");
    expect(html).toContain("https://app.ex/compras/1");
  });

  it("html sem assinatura quando ausente", () => {
    const html = buildEmailHtml("Oi", "", "", null);
    expect(html).toContain("Oi");
    expect(html).not.toContain("<hr");
  });
});
