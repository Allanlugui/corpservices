import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfSection {
  title: string;
  rows: [string, string][];
}

export interface PdfDoc {
  title: string;
  subtitle: string;
  sections: PdfSection[];
  generatedBy: string;
}

const MARGIN = 50;
const LINE = 16;

/** Helvetica WinAnsi não tem →, •, ×: normaliza antes de medir/desenhar. */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\u00FF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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

/** Gera PDF com cabeçalho, seções, paginação e trilha de geração. */
export async function buildPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage();
  let pageNum = 1;
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  function footer(p: PDFPage, n: number) {
    p.drawText(`Página ${n} · gerado em ${new Date().toLocaleString("pt-BR")} por ${doc.generatedBy}`, {
      x: MARGIN,
      y: 30,
      size: 8,
      font: regular,
    });
  }

  function need(lines = 1) {
    if (y - lines * LINE < MARGIN + 10) {
      footer(page, pageNum);
      page = pdf.addPage();
      pageNum += 1;
      y = page.getSize().height - MARGIN;
    }
  }

  function text(t: string, opts: { bold?: boolean; size?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? bold : regular;
    for (const line of wrap(sanitizePdfText(t), font, size, width - MARGIN * 2)) {
      need();
      page.drawText(line, { x: MARGIN, y, size, font });
      y -= LINE * (size / 10);
    }
    y -= opts.gap ?? 2;
  }

  need(3);
  text("CorpServices", { bold: true, size: 16 });
  text(doc.title, { bold: true, size: 13 });
  text(doc.subtitle, { size: 10, gap: 8 });

  for (const section of doc.sections) {
    need(2);
    text(section.title, { bold: true, size: 11, gap: 4 });
    for (const [k, v] of section.rows) {
      text(`${k}: ${v || "—"}`, { size: 10 });
    }
    y -= 6;
  }

  footer(page, pageNum);
  return pdf.save();
}
