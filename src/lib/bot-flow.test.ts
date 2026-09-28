import { describe, expect, it } from "vitest";
import { detectConfirm, detectKind, detectLevel, isValidEmail, matchLocation } from "./bot-flow";

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

const ESTRUTURA = [
  { id: "r", path: "Unidade Pinheiros" },
  { id: "a1", path: "Unidade Pinheiros › 1° andar" },
  { id: "a2", path: "Unidade Pinheiros › 2° andar" },
  { id: "la", path: "Unidade Pinheiros › 2° andar › Lado A" },
  { id: "ba", path: "Unidade Pinheiros › 1° andar › Bloco A" },
  { id: "bb", path: "Unidade Pinheiros › 1° andar › Bloco B" },
];

describe("matchLocation", () => {
  it("entende ordinal + bloco", () => {
    const m = matchLocation("Segundo andar lado A", ESTRUTURA);
    expect(m[0]?.id).toBe("la");
  });

  it("número direto casa", () => {
    const m = matchLocation("bloco B, primeiro andar", ESTRUTURA);
    expect(m[0]?.id).toBe("bb");
  });

  it("não chuta sem evidência", () => {
    expect(matchLocation("olá", ESTRUTURA).length).toBe(0);
    expect(matchLocation("banheiro", ESTRUTURA).length).toBe(0);
  });
});
