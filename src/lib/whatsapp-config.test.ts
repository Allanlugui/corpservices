import { describe, expect, it } from "vitest";
import { formatPhone, resolveWhatsConfig } from "./whatsapp-config";

describe("whatsapp-config", () => {
  it("disabled sem token/phone", () => {
    expect(resolveWhatsConfig({}).enabled).toBe(false);
  });

  it("ativo com credenciais + template padrão", () => {
    const cfg = resolveWhatsConfig({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "p" });
    expect(cfg.enabled).toBe(true);
    expect(cfg.template).toBe("hello_world");
  });

  it("normaliza BR para E.164", () => {
    expect(formatPhone("(11) 99999-9999")).toBe("5511999999999");
    expect(formatPhone("+55 11 99999-9999")).toBe("5511999999999");
    expect(formatPhone("5511999999999")).toBe("5511999999999");
  });

  it("rejeita inválidos sem enviar errado", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("123")).toBe("");
    expect(formatPhone("abc")).toBe("");
  });
});
