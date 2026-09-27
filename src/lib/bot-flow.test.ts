import { describe, expect, it } from "vitest";
import { detectConfirm, detectKind, detectLevel, isValidEmail } from "./bot-flow";

describe("bot-flow (B5)", () => {
  it("detecta compra e serviço em texto livre", () => {
    expect(detectKind("preciso comprar 10 parafusos")).toBe("compra");
    expect(detectKind("o ar condicionado quebrou e vaza água")).toBe("servico");
    expect(detectKind("olá, bom dia")).toBeNull();
  });

  it("normaliza urgência por sinônimos", () => {
    expect(detectLevel("é urgente, tudo parado")).toBe("critica");
    expect(detectLevel("prioridade alta")).toBe("alta");
    expect(detectLevel("quando der, sem pressa")).toBe("media");
    expect(detectLevel("hmm")).toBeNull();
  });

  it("sim/não", () => {
    expect(detectConfirm("sim, pode enviar")).toBe(true);
    expect(detectConfirm("não, está errado")).toBe(false);
    expect(detectConfirm("talvez")).toBeNull();
  });

  it("e-mail", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("sem-arroba")).toBe(false);
  });
});
