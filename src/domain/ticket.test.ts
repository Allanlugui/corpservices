import { describe, expect, it } from "vitest";
import { canTransition, transition } from "./ticket-states";
import { DeterministicProvider } from "./botia";

describe("ticket-states", () => {
  it("NOVO so vai para EM_TRIAGEM", () => {
    expect(canTransition("NOVO", "EM_TRIAGEM")).toBe(true);
    expect(canTransition("NOVO", "RESOLVIDO")).toBe(false);
    expect(() => transition("NOVO", "ENCERRADO")).toThrow();
  });

  it("RESOLVIDO pode reabrir para EM_ANALISE ou encerrar", () => {
    expect(canTransition("RESOLVIDO", "EM_ANALISE")).toBe(true);
    expect(canTransition("RESOLVIDO", "ENCERRADO")).toBe(true);
    expect(canTransition("RESOLVIDO", "NOVO")).toBe(false);
  });

  it("ENCERRADO e terminal", () => {
    expect(canTransition("ENCERRADO", "EM_ANALISE")).toBe(false);
  });
});

describe("DeterministicProvider", () => {
  const bot = new DeterministicProvider();

  it("classifica compra por palavras-chave", async () => {
    const r = await bot.triage({
      kind: "servico",
      fields: { descricao: "preciso comprar 10 pecas do fornecedor", item: "peca X", quantidade: "10", prazo: "30d", criticidade: "alta", justificativa: "reposicao" },
    });
    expect(r.suggestedKind).toBe("compra");
  });

  it("em empate respeita a escolha do solicitante", async () => {
    const r = await bot.triage({ kind: "compra", fields: { item: "x" } });
    expect(r.suggestedKind).toBe("compra");
  });

  it("lista campos faltantes sem inventar", async () => {
    const r = await bot.triage({ kind: "servico", fields: { descricao: "vazamento no banheiro" } });
    expect(r.suggestedKind).toBe("servico");
    expect(r.missingFields).toEqual(["local", "prioridade"]);
  });
});
