import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseDanfeText } from "./danfe";

const LINES = [
  "DANFE Documento Auxiliar da Nota Fiscal Eletronica",
  "DISTRIBUIDORA EXEMPLO LTDA",
  "Rua das Flores, 100 - Sao Paulo/SP",
  "CNPJ: 12.345.678/0001-90",
  "DADOS DOS PRODUTOS",
  "001 PARAFUSO SEXTAVADO M8 100 10,00 1.000,00",
  "7891234567890 CIMENTO CP II 50 SC 50 25,50 1.275,00",
  "VALOR TOTAL DA NOTA 2.275,00",
];

describe("danfe-pdf-e2e", () => {
  it("pdf real -> texto (pdfjs) -> itens (parser)", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    LINES.forEach((l, i) => page.drawText(l, { x: 50, y: 750 - i * 22, size: 11, font }));
    const bytes = await pdf.save();

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const parts: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const content = await pg.getTextContent();
      parts.push(content.items.map((it) => ("str" in it ? (it.str as string) : "")).join("\n"));
    }
    const parsed = parseDanfeText(parts.join("\n"));
    expect(parsed.issuerDoc).toBe("12345678000190");
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].name).toContain("PARAFUSO");
    expect(parsed.warnings.length).toBe(0);
  });
});
