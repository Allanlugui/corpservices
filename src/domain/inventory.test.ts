import { describe, expect, it } from "vitest";
import { applyMovement, applyReturn, applyWithdrawal, availableQty, expiryAlert, incompleteFields, planReserve, stockAlert } from "./inventory";

describe("inventory", () => {
  it("entrada soma, saida subtrai, ajuste define", () => {
    expect(applyMovement(10, "entrada", 5)).toBe(15);
    expect(applyMovement(10, "saida", 4)).toBe(6);
    expect(applyMovement(10, "ajuste", 1, 7)).toBe(7);
  });

  it("saida sem saldo e quantidade invalida falham", () => {
    expect(() => applyMovement(2, "saida", 5)).toThrow();
    expect(() => applyMovement(10, "entrada", 0)).toThrow();
    expect(() => applyMovement(10, "ajuste", 1)).toThrow();
  });

  it("alertas de nivel", () => {
    expect(stockAlert(0, 5, 100)).toBe("zerado");
    expect(stockAlert(3, 5, 100)).toBe("baixo");
    expect(stockAlert(50, 5, 100)).toBe("ok");
    expect(stockAlert(150, 5, 100)).toBe("excesso");
  });

  it("alertas de validade (now injetado)", () => {
    const now = Date.parse("2026-09-26T00:00:00Z");
    expect(expiryAlert(null, now)).toBe("nao_aplicavel");
    expect(expiryAlert("2026-09-01", now)).toBe("vencido");
    expect(expiryAlert("2026-10-10", now)).toBe("proximo");
    expect(expiryAlert("2027-04-15", now)).toBe("ok");
  });

  it("entrada tolerante lista pendencias", () => {
    expect(incompleteFields({ name: "x" })).toEqual(["unidade", "categoria", "custo"]);
    expect(incompleteFields({ name: "x", unit: "un", category: "c", cost: 10 })).toEqual([]);
  });
});

describe("reserva F31 (empenho)", () => {
  it("disponível desconta empenhado", () => {
    expect(availableQty(10, 4)).toBe(6);
    expect(availableQty(2, 5)).toBe(0);
  });

  it("reserva até o disponível; resto é falta (auto-SC)", () => {
    expect(planReserve(10, 4, 5)).toEqual({ reserved: 5, missing: 0 });
    expect(planReserve(10, 8, 5)).toEqual({ reserved: 2, missing: 3 });
    expect(planReserve(0, 0, 5)).toEqual({ reserved: 0, missing: 5 });
  });

  it("retirada baixa físico e empenho", () => {
    expect(applyWithdrawal(10, 4, 3)).toEqual({ quantity: 7, reserved: 1 });
    expect(() => applyWithdrawal(10, 2, 3)).toThrow();
  });

  it("devolução volta físico e libera empenho", () => {
    expect(applyReturn(7, 1, 1)).toEqual({ quantity: 8, reserved: 0 });
    expect(() => applyReturn(7, 1, 2)).toThrow();
  });
});
