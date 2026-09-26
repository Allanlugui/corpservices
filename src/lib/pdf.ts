import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfTable {
  headers: string[];
  rows: string[][];
}

export interface PdfSection {
  title: string;
  rows?: [string, string][];
  table?: PdfTable;
}

export interface PdfDoc {
  title: string;
  subtitle: string;
  meta: [string, string][];
  sections: PdfSection[];
  generatedBy: string;
}

const MARGIN = 48;
const BRAND = rgb(0.09, 0.16, 0.35);
const ACCENT = rgb(0.11, 0.31, 0.85);
const MUTED = rgb(0.4, 0.44, 0.52);
const LINE_COLOR = rgb(0.88, 0.9, 0.93);
const ZEBRA = rgb(0.96, 0.97, 0.98);

/** Helvetica WinAnsi não tem →, •, ×: normaliza antes de medir/desenhar. */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\u00FF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/** PDF profissional: faixa de marca, tabelas zebra, divisórias e rodapé paginado. */
export async function buildPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage();
  let pageNum = 1;
  const W = page.getSize().width;
  const H = page.getSize().height;
  const contentWidth = W - MARGIN * 2;
  let y = H - MARGIN;

  function footer(p: PDFPage, n: number, total: { count: number }) {
    const label = `CorpServices · gerado em ${new Date().toLocaleString("pt-BR")} por ${doc.generatedBy} · página ${n} de ${total.count}`;
    p.drawText(sanitizePdfText(label), { x: MARGIN, y: 28, size: 7.5, font: regular, color: MUTED });
    p.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: W - MARGIN, y: 38 }, thickness: 0.5, color: LINE_COLOR });
  }

  function need(h: number) {
    if (y - h < 56) {
      page = pdf.addPage();
      pageNum += 1;
      y = page.getSize().height - MARGIN;
    }
  }

  function rule() {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.75, color: LINE_COLOR });
    y -= 10;
  }

  function paragraph(t: string, size: number, font: PDFFont, color = rgb(0.1, 0.12, 0.16), gap = 2) {
    for (const line of wrap(t, font, size, contentWidth)) {
      need(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size + 4;
    }
    y -= gap;
  }

  // Faixa de marca
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: BRAND });
  page.drawText("CorpServices", { x: MARGIN, y: H - 42, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(sanitizePdfText("Gestão de chamados, ordens de serviço, compras e estoque"), {
    x: MARGIN, y: H - 62, size: 9, font: regular, color: rgb(0.82, 0.86, 0.94),
  });
  y = H - 112;

  paragraph(doc.title, 15, bold, BRAND, 2);
  paragraph(doc.subtitle, 10, regular, MUTED, 6);
  for (const [k, v] of doc.meta) {
    paragraph(`${k}: ${v || "—"}`, 9, regular, MUTED, 0);
  }
  y -= 8;

  for (const section of doc.sections) {
    need(30);
    paragraph(section.title.toUpperCase(), 10, bold, ACCENT, 2);
    rule();
    if (section.rows) {
      for (const [k, v] of section.rows) {
        need(20);
        const keyW = Math.min(170, contentWidth * 0.32);
        for (const line of wrap(`${k}:`, bold, 9, keyW)) {
          need(13);
          page.drawText(line, { x: MARGIN, y, size: 9, font: bold });
          y -= 13;
        }
        const valY = y + 13 * wrap(`${k}:`, bold, 9, keyW).length;
        let vy = valY;
        for (const line of wrap(v || "—", regular, 9, contentWidth - keyW - 12)) {
          need(13);
          page.drawText(line, { x: MARGIN + keyW + 12, y: vy, size: 9, font: regular });
          vy -= 13;
        }
        y = Math.min(y, vy) - 4;
      }
    }
    if (section.table) {
      const cols = section.table.headers.length;
      const colW = contentWidth / cols;
      const drawRow = (cells: string[], header: boolean, zebra: boolean) => {
        const wrappedCells = cells.map((c) => wrap(c, header ? bold : regular, 8.5, colW - 10));
        const h = Math.max(...wrappedCells.map((w) => w.length)) * 12 + 8;
        need(h);
        if (zebra) {
          page.drawRectangle({ x: MARGIN, y: y - h + 4, width: contentWidth, height: h, color: ZEBRA });
        }
        wrappedCells.forEach((lines, ci) => {
          lines.forEach((line, li) => {
            page.drawText(line, {
              x: MARGIN + 5 + ci * colW,
              y: y - 10 - li * 12,
              size: 8.5,
              font: header ? bold : regular,
              color: header ? rgb(1, 1, 1) : rgb(0.1, 0.12, 0.16),
            });
          });
        });
        if (header) {
          page.drawRectangle({ x: MARGIN, y: y - h + 4, width: contentWidth, height: h, color: BRAND, opacity: 1 });
          wrappedCells.forEach((lines, ci) => {
            lines.forEach((line, li) => {
              page.drawText(line, { x: MARGIN + 5 + ci * colW, y: y - 10 - li * 12, size: 8.5, font: bold, color: rgb(1, 1, 1) });
            });
          });
        }
        y -= h;
      };
      drawRow(section.table.headers.map(sanitizePdfText), true, false);
      section.table.rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
      y -= 4;
    }
    y -= 8;
  }

  const total = { count: pageNum };
  const pages = pdf.getPages();
  pages.forEach((p, i) => footer(p, i + 1, total));
  return pdf.save();
}
