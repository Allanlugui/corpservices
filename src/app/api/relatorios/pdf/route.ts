import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { buildPdf } from "@/lib/pdf";
import { buildReportRows, type ReportEntity, type ReportPeriodo } from "../route";

const LABELS: Record<ReportEntity, string> = {
  tickets: "Chamados",
  os: "Ordens de serviço",
  compras: "Compras",
  estoque: "Estoque",
  movimentacoes: "Movimentações",
  financeiro: "Financeiro",
};

/** PDF do relatório (documento de verdade, não impressão da página). */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const parsed = z.object({
      entity: z.enum(["tickets", "os", "compras", "estoque", "movimentacoes", "financeiro"]),
      periodo: z.enum(["dia", "semana", "mes", "trimestre", "ano", "tudo"]).default("mes"),
      status: z.string().optional(),
      categoria: z.string().max(80).optional(),
      produto: z.string().max(120).optional(),
      fornecedor: z.string().max(120).optional(),
    }).safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const { entity, periodo, status, categoria, produto, fornecedor } = parsed.data;
    const moduleOf: Record<string, "tickets" | "work_orders" | "purchases" | "inventory" | "reports"> = {
      tickets: "tickets",
      os: "work_orders",
      compras: "purchases",
      estoque: "inventory",
      movimentacoes: "inventory",
      financeiro: "reports",
    };
    if (!canSession(session, moduleOf[entity], "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const rows = await buildReportRows(admin, session.orgId, entity as ReportEntity, periodo as ReportPeriodo, status, { status, categoria, produto, fornecedor });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : ["sem dados"];
    const tableRows = rows.slice(0, 300).map((r) => headers.map((h) => String(r[h] ?? "—").slice(0, 60)));
    const bytes = await buildPdf({
      title: `Relatório — ${LABELS[entity as ReportEntity]}`,
      subtitle: `Período: ${periodo}${status ? ` · filtro: ${status}` : ""} · ${rows.length} linha(s)`,
      meta: [["Gerado por", session.email]],
      sections: [{
        title: LABELS[entity as ReportEntity],
        table: { headers, rows: tableRows },
      }],
      generatedBy: session.email,
    });
    const body = Buffer.from(bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-${entity}-${periodo}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
