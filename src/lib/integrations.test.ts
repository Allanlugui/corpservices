import { describe, expect, it } from "vitest";
import { getIntegrations } from "./integrations";

describe("getIntegrations", () => {
  it("relata tudo como nao configurado/pendente sem variaveis", () => {
    const items = getIntegrations({});
    const byName = new Map(items.map((i) => [i.name, i.status]));
    expect(byName.get("Supabase (banco + auth)")).toBe("NAO_CONFIGURADO");
    expect(byName.get("ERP")).toBe("PENDENTE_DE_INTEGRACAO");
    expect(byName.get("Provedor IA (LLM)")).toBe("PENDENTE_DE_INTEGRACAO");
    expect(byName.get("E-mail (Resend)")).toBe("NAO_CONFIGURADO");
    expect(byName.get("Push (VAPID)")).toBe("PENDENTE_DE_INTEGRACAO");
    expect(byName.get("WhatsApp")).toBe("PENDENTE_DE_INTEGRACAO");
  });

  it("reconhece resend com chave presente", () => {
    const items = getIntegrations({ RESEND_API_KEY: "re_x" });
    expect(items.find((i) => i.name.startsWith("E-mail"))?.status).toBe("CONFIGURADO");
  });

  it("reconhece supabase apenas com as duas variaveis presentes", () => {
    const items = getIntegrations({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k" });
    expect(items.find((i) => i.name.startsWith("Supabase"))?.status).toBe("CONFIGURADO");
  });

  it("aceita variaveis NEXT_PUBLIC_* (caso Vercel)", () => {
    const items = getIntegrations({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
    });
    expect(items.find((i) => i.name.startsWith("Supabase"))?.status).toBe("CONFIGURADO");
  });

  it("nunca declara ERP como conectado sem integracao real", () => {
    for (const env of [{}, { SUPABASE_URL: "u", SUPABASE_ANON_KEY: "k" }]) {
      expect(getIntegrations(env).find((i) => i.name === "ERP")?.status).not.toBe("CONFIGURADO");
    }
  });
});
