import { describe, expect, it } from "vitest";
import { canTransitionPurchase, transitionPurchase } from "./purchase-states";

describe("purchase-states", () => {
  it("ciclo feliz ate CONCLUIDA", () => {
    const flow = ["EM_ANALISE", "DESIGNADA", "COTACAO", "AGUARDANDO_APROVACAO", "APROVADA", "NEGOCIACAO", "PAGAMENTO", "EM_TRANSITO", "RECEBIDA", "CONCLUIDA"] as const;
    let from: (typeof flow)[number] | "SOLICITADA" = "SOLICITADA";
    for (const to of flow) {
      expect(transitionPurchase(from, to)).toBe(to);
      from = to;
    }
  });

  it("rejeicao exige justificativa no fluxo (estado volta a SOLICITADA)", () => {
    expect(canTransitionPurchase("AGUARDANDO_APROVACAO", "REJEITADA")).toBe(true);
    expect(canTransitionPurchase("REJEITADA", "SOLICITADA")).toBe(true);
    expect(canTransitionPurchase("REJEITADA", "APROVADA")).toBe(false);
  });

  it("rejeita saltos e saidas do terminal", () => {
    expect(() => transitionPurchase("SOLICITADA", "APROVADA")).toThrow();
    expect(canTransitionPurchase("CONCLUIDA", "CANCELADA")).toBe(false);
    expect(canTransitionPurchase("CANCELADA", "SOLICITADA")).toBe(false);
  });
});
