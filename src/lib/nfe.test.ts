import { describe, expect, it } from "vitest";
import { nameTokens } from "./nfe";

describe("nameTokens (dedupe M-02)", () => {
  it("normaliza acento, caixa e stopwords", () => {
    expect(nameTokens("Óleo Lubrificante de Motor")).toEqual(["oleo", "lubrificante", "motor"]);
  });

  it("remove tokens curtos e unidades", () => {
    expect(nameTokens("Parafuso M8 UN")).toEqual(["parafuso"]);
  });

  it("mantém núcleo mesmo com sufixo de NF-e", () => {
    const tokens = nameTokens("Dell Notebook Latitude 7000 7320 I7 16GB SSD 512");
    expect(tokens.slice(0, 5)).toEqual(["dell", "notebook", "latitude", "7000", "7320"]);
  });

  it("vazio quando só há ruído", () => {
    expect(nameTokens("de e do")).toEqual([]);
  });
});
