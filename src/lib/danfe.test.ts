import { describe, expect, it } from "vitest";
import { extractIssuer, extractItems, groupByLine, parseBrNumber, parseDanfeText } from "./danfe";

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

  it("parse completo com aviso de conferência", () => {
    const parsed = parseDanfeText(DANFE);
    expect(parsed.items.length).toBe(2);
    expect(parsed.warnings.length).toBe(1);
    expect(parsed.warnings[0]).toContain("confira");
  });

  it("PDF sem texto retorna aviso honesto", () => {
    const parsed = parseDanfeText("   \n  ");
    expect(parsed.items.length).toBe(0);
    expect(parsed.warnings.length).toBe(1);
  });

  it("groupByLine reordena spans fora de ordem em linhas visuais", () => {
    const spans = [
      { str: "M8", transform: [1, 0, 0, 1, 200, 500] },
      { str: "001 PARAFUSO", transform: [1, 0, 0, 1, 50, 500] },
      { str: "CNPJ: 12.345.678/0001-90", transform: [1, 0, 0, 1, 50, 550] },
    ];
    const text = groupByLine(spans);
    const lines = text.split("\n");
    expect(lines[0]).toContain("CNPJ");
    expect(lines[1]).toBe("001 PARAFUSO M8");
  });

  it("DANFE real: só a seção de produtos vira item (totais ignorados)", () => {
    const doc = [
      "DANFE Documento Auxiliar",
      "DISTRIBUIDORA EXEMPLO LTDA",
      "CNPJ: 12.345.678/0001-90",
      "FATURA Duplicata 001 Vencimento 10/10/2026 Valor 2.275,00 2.275,00",
      "CÁLCULO DO IMPOSTO Base de Cálculo do ICMS 2.275,00 Valor do ICMS 409,50",
      "DADOS DOS PRODUTOS",
      "CÓDIGO DESCRIÇÃO NCM UN QTD VLR UNIT VLR TOTAL",
      "001 PARAFUSO SEXTAVADO M8 7318 UN 100 10,00 1.000,00",
      "DE AÇO INOXIDÁVEL",
      "002 CIMENTO CP II 2523 SC 50 25,50 1.275,00",
      "CÁLCULO DO IMPOSTO",
      "VALOR TOTAL DA NOTA 2.275,00",
      "DADOS ADICIONAIS Informações Complementares",
    ].join("\n");
    const parsed = parseDanfeText(doc);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].name).toContain("INOX");
    expect(parsed.items[0].quantity).toBe(100);
    expect(parsed.items[1].cost_cents).toBe(2550);
  });
});
