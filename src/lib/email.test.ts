import { describe, expect, it } from "vitest";
import { buildEmailBody, resolveEmailConfig } from "./email-config";

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
});
