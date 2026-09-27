import { describe, expect, it } from "vitest";
import { extractIssuer, extractItems, parseBrNumber, parseDanfeText } from "./danfe";

const DANFE = [
  "DANFE Documento Auxiliar da Nota Fiscal Eletrônica",
  "DISTRIBUIDORA EXEMPLO LTDA",
  "Rua das Flores, 100 - Sao Paulo/SP",
  "CNPJ: 12.345.678/0001-90",
  "DADOS DOS PRODUTOS",
  "001 PARAFUSO SEXTAVADO M8 100 10,00 1.000,00",
  "7891234567890 CIMENTO CP II 50 SC 50 25,50 1.275,00",
  "VALOR TOTAL DA NOTA 2.275,00",
].join("\n");

describe("danfe", () => {
  it("parseBrNumber entende pt-BR", () => {
    expect(parseBrNumber("1.275,00")).toBe(1275);
    expect(parseBrNumber("25,50")).toBe(25.5);
  });

  it("extrai emitente pelo CNPJ", () => {
    const { issuer, issuerDoc } = extractIssuer(DANFE.split("\n"));
    expect(issuerDoc).toBe("12345678000190");
    expect(issuer).toContain("DISTRIBUIDORA");
  });

  it("extrai itens com quantidade e custo", () => {
    const items = extractItems(DANFE.split("\n"));
    expect(items.length).toBe(2);
    expect(items[0].name).toContain("PARAFUSO");
    expect(items[0].quantity).toBe(100);
    expect(items[0].cost_cents).toBe(1000);
    expect(items[1].barcode).toBe("7891234567890");
  });

  it("parse completo com warnings honestos", () => {
    const parsed = parseDanfeText(DANFE);
    expect(parsed.items.length).toBe(2);
    expect(parsed.warnings.length).toBe(0);
  });

  it("PDF sem texto retorna aviso honesto", () => {
    const parsed = parseDanfeText("   \n  ");
    expect(parsed.items.length).toBe(0);
    expect(parsed.warnings.length).toBe(1);
  });
});
