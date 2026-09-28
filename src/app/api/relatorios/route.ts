import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

const querySchema = z.object({
  entity: z.enum(["tickets", "os", "compras", "estoque", "movimentacoes", "financeiro"]),
  periodo: z.enum(["dia", "semana", "mes", "trimestre", "ano", "tudo"]).default("mes"),
  status: z.string().optional(),
  categoria: z.string().max(80).optional(),
  produto: z.string().max(120).optional(),
  fornecedor: z.string().max(120).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

const PERIOD_MS = {
  dia: 86_400_000,
  semana: 7 * 86_400_000,
  mes: 30 * 86_400_000,
  trimestre: 90 * 86_400_000,
  ano: 365 * 86_400_000,
  tudo: 10 * 365 * 86_400_000,
} as const;

const PERM: Record<string, [string, string]> = {
  tickets: ["tickets", "read"],
  os: ["work_orders", "read"],
  compras: ["purchases", "read"],
  estoque: ["inventory", "read"],
  movimentacoes: ["inventory", "read"],
  financeiro: ["reports", "read"],
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "sem dados\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  // BOM para Excel abrir UTF-8 corretamente (escape explícito).
  const BOM = String.fromCharCode(65279);
  return BOM + [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export type ReportEntity = "tickets" | "os" | "compras" | "estoque" | "movimentacoes" | "financeiro";
export type ReportPeriodo = keyof typeof PERIOD_MS;

export interface ReportFilters {
  status?: string;
  categoria?: string;
  produto?: string;
  fornecedor?: string;
}

export async function buildReportRows(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  entity: ReportEntity,
  periodo: ReportPeriodo,
  status?: string,
  filters?: ReportFilters,
): Promise<Record<string, unknown>[]> {
  const f = filters ?? (status ? { status } : {});
  const since = new Date(Date.now() - PERIOD_MS[periodo]).toISOString();
  let rows: Record<string, unknown>[] = [];

  // FIN-01: custo operacional — valores de pedidos + estoque + volumes + série mensal.
  if (entity === "financeiro") {
    const [{ data: orders }, { data: products }, { data: tickets }, { data: wos }] = await Promise.all([
      admin.from("purchase_orders").select("amount_cents, currency, status, created_at, request_id").gte("created_at", since).limit(2000),
      admin.from("products").select("quantity, cost_cents").eq("org_id", orgId).eq("active", true).limit(2000),
      admin.from("tickets").select("status").eq("org_id", orgId).gte("created_at", since).limit(2000),
      admin.from("work_orders").select("status").eq("org_id", orgId).gte("created_at", since).limit(2000),
    ]);
    // Pedidos só da org: filtra via requests da org.
    const { data: reqs } = await admin.from("purchase_requests").select("id").eq("org_id", orgId);
    const ids = new Set((reqs ?? []).map((r) => r.id as string));
    const mine = (orders ?? []).filter((o) => ids.has(o.request_id as string));
    const sum = (st: string[]) => mine.filter((o) => st.includes(o.status as string)).reduce((a, o) => a + Number(o.amount_cents), 0);
    const stockValue = (products ?? []).reduce((a, p) => a + Number(p.quantity) * Number(p.cost_cents), 0);
    const toRs = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const countBy = (list: { status: unknown }[], st: string) => list.filter((r) => r.status === st).length;
    rows = [
      { indicador: "Pedidos em aberto (R$)", valor: toRs(sum(["ABERTO"])) },
      { indicador: "Pedidos pagos (R$)", valor: toRs(sum(["PAGO"])) },
      { indicador: "Pedidos recebidos (R$)", valor: toRs(sum(["RECEBIDO"])) },
      { indicador: "Pedidos cancelados (R$)", valor: toRs(sum(["CANCELADO"])) },
      { indicador: "Estoque valorizado (R$)", valor: toRs(stockValue) },
      { indicador: "Pedidos no período", valor: String(mine.length) },
      { indicador: "Chamados no período", valor: String((tickets ?? []).length) },
      { indicador: "Chamados concluídos", valor: String(countBy((tickets ?? []) as { status: unknown }[], "CONCLUIDO")) },
      { indicador: "OS no período", valor: String((wos ?? []).length) },
      { indicador: "OS encerradas", valor: String(countBy((wos ?? []) as { status: unknown }[], "ENCERRADA")) },
    ];
    // Série mensal (últimos 6 meses): recebido + pago em R$.
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" });
      const inMonth = mine.filter((o) => {
        const c = new Date(o.created_at as string);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      const tot = (st: string[]) => inMonth.filter((o) => st.includes(o.status as string)).reduce((a, o) => a + Number(o.amount_cents), 0);
      rows.push({ indicador: `Recebido em ${label} (R$)`, valor: toRs(tot(["RECEBIDO"])) });
      rows.push({ indicador: `Pago em ${label} (R$)`, valor: toRs(tot(["PAGO"])) });
    }
  } else if (entity === "tickets") {
    let q = admin.from("tickets").select("number, kind, status, requester_name, requester_email, created_at").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (f.status) q = q.eq("status", f.status);
    if (f.categoria) q = q.ilike("category", `%${f.categoria}%`);
    rows = ((await q).data ?? []) as Record<string, unknown>[];
  } else if (entity === "os") {
    let q = admin.from("work_orders").select("number, title, status, priority, sla_remaining_ms, started_at, finished_at, created_at").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (f.status) q = q.eq("status", f.status);
    rows = (((await q).data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, sla_restante_h: Math.round(Number(r.sla_remaining_ms) / 3600000) }));
  } else if (entity === "compras") {
    let q = admin.from("purchase_requests").select("number, origin, status, priority, justification, created_at").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (f.status) q = q.eq("status", f.status);
    if (f.fornecedor) {
      const [qq, qo] = await Promise.all([
        admin.from("purchase_quotes").select("request_id").ilike("supplier", `%${f.fornecedor}%`).limit(500),
        admin.from("purchase_orders").select("request_id").ilike("supplier", `%${f.fornecedor}%`).limit(500),
      ]);
      const ids = new Set([...((qq.data ?? []) as { request_id: string }[]), ...((qo.data ?? []) as { request_id: string }[])].map((r) => r.request_id));
      if (ids.size === 0) {
        rows = [];
      } else {
        const { data } = await q.in("id", [...ids]);
        rows = (data ?? []) as Record<string, unknown>[];
      }
    } else {
      rows = ((await q).data ?? []) as Record<string, unknown>[];
    }
  } else if (entity === "estoque") {
    let pq = admin.from("products").select("name, unit, quantity, stock_min, stock_max, cost_cents, location").eq("org_id", orgId).eq("active", true).order("name").limit(500);
    if (f.produto) pq = pq.ilike("name", `%${f.produto}%`);
    const { data } = await pq;
    rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, custo_rs: Number(r.cost_cents) / 100 }));
  } else {
    let q = admin.from("inventory_movements").select("kind, quantity, reason, created_at, product_id").eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (f.status) q = q.eq("kind", f.status);
    if (f.produto) {
      const { data: prods } = await admin.from("products").select("id").eq("org_id", orgId).ilike("name", `%${f.produto}%`).limit(200);
      const pids = (prods ?? []).map((p) => (p as { id: string }).id);
      if (pids.length === 0) {
        rows = [];
      } else {
        const { data } = await q.in("product_id", pids);
        rows = ((data ?? []) as { kind: string; quantity: number; reason: string; created_at: string }[]).map((r) => ({
          tipo: r.kind,
          quantidade: r.quantity,
          motivo: r.reason,
          em: r.created_at,
        }));
      }
    } else {
      rows = (((await q).data ?? []) as { kind: string; quantity: number; reason: string; created_at: string }[]).map((r) => ({
        tipo: r.kind,
        quantidade: r.quantity,
        motivo: r.reason,
        em: r.created_at,
      }));
    }
  }
  return rows;
}

/** Central de relatórios: filtros por entidade/período/status + export CSV. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const { entity, periodo, status, categoria, produto, fornecedor, format } = parsed.data;
    const [module, action] = PERM[entity] as [string, string];
    if (!canSession(session, module as "tickets", action as "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const rows = await buildReportRows(admin, session.orgId, entity, periodo, status, { status, categoria, produto, fornecedor });
    if (format === "csv") {
      return new Response(toCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="relatorio-${entity}-${periodo}.csv"`,
        },
      });
    }
    return ok({ rows, total: rows.length });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
