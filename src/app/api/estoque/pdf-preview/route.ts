import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { findMatches, resolveSupplier } from "@/lib/nfe";
import { parseDanfeText, groupByLine } from "@/lib/danfe";

/**
 * Prévia de DANFE (PDF) SEM salvar. Mesmo contrato do xml-preview para
 * reaproveitar a revisão M-01/M-02; entrada-xml legada segue intacta.
 */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const parsed = z.object({ pdf_base64: z.string().min(100).max(12_000_000) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "PDF ausente.", 422);
    let text: string;
    try {
      // unpdf: pdfjs configurado p/ serverless (pdfjs puro quebra na Vercel
      // sem DOMMatrix/canvas). Itens + groupByLine = linhas visuais.
      const { getDocumentProxy } = await import("unpdf");
      const bytes = Buffer.from(parsed.data.pdf_base64, "base64");
      if (bytes.subarray(0, 5).toString() !== "%PDF-") return fail("PDF_INVALID", "Arquivo nao e um PDF valido.", 422);
      const doc = await getDocumentProxy(new Uint8Array(bytes));
      const parts: string[] = [];
      const pages = Math.min(doc.numPages, 10);
      for (let p = 1; p <= pages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        parts.push(groupByLine(content.items as unknown[]));
      }
      text = parts.join("\n");
    } catch {
      return fail("PDF_PARSE", "Nao foi possivel ler o PDF.", 422);
    }
    const danfe = parseDanfeText(text);
    const admin = createAdminClient();
    const supplier = await resolveSupplier(admin, session.orgId, danfe.issuer, danfe.issuerDoc);
    const items = await Promise.all(
      danfe.items.map(async (item, index) => ({
        index,
        ...item,
        matches: await findMatches(admin, session.orgId, item),
      })),
    );
    return ok({
      issuer: danfe.issuer,
      supplier_id: supplier.id,
      supplier_created: supplier.created,
      items,
      warnings: danfe.warnings,
      source: "danfe-pdf",
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
