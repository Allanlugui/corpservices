import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const querySchema = z.object({
  entity: z.enum(["tickets", "os", "compras", "estoque", "movimentacoes"]),
  periodo: z.enum(["dia", "semana", "mes", "trimestre", "ano", "tudo"]).default("mes"),
  status: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

const PERIOD_MS: Record<string, number> = {
  dia: 86_400_000,
  semana: 7 * 86_400_000,
  mes: 30 * 86_400_000,
  trimestre: 90 * 86_400_000,
  ano: 365 * 86_400_000,
  tudo: 10 * 365 * 86_400_000,
};

const PERM: Record<string, [string, string]> = {
  tickets: ["tickets", "read"],
  os: ["work_orders", "read"],
  compras: ["purchases", "read"],
  estoque: ["inventory", "read"],
  movimentacoes: ["inventory", "read"],
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "sem dados\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  // BOM para Excel abrir UTF-8 corretamente (escape explícito).
  const BOM = String.fromCharCode(65279);
  return BOM + [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

/** Central de relatórios: filtros por entidade/período/status + export CSV. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const { entity, periodo, status, format } = parsed.data;
    const [module, action] = PERM[entity] as [string, string];
    if (!can(session.role, module as "tickets", action as "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const since = new Date(Date.now() - PERIOD_MS[periodo]).toISOString();
    let rows: Record<string, unknown>[] = [];

    if (entity === "tickets") {
      let q = admin.from("tickets").select("number, kind, status, requester_name, requester_email, created_at").eq("org_id", session.orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      if (status) q = q.eq("status", status);
      rows = ((await q).data ?? []) as Record<string, unknown>[];
    } else if (entity === "os") {
      let q = admin.from("work_orders").select("number, title, status, priority, sla_remaining_ms, started_at, finished_at, created_at").eq("org_id", session.orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      if (status) q = q.eq("status", status);
      rows = (((await q).data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, sla_restante_h: Math.round(Number(r.sla_remaining_ms) / 3600000) }));
    } else if (entity === "compras") {
      let q = admin.from("purchase_requests").select("number, origin, status, priority, justification, created_at").eq("org_id", session.orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      if (status) q = q.eq("status", status);
      rows = ((await q).data ?? []) as Record<string, unknown>[];
    } else if (entity === "estoque") {
      const { data } = await admin.from("products").select("name, unit, quantity, stock_min, stock_max, cost_cents, location").eq("org_id", session.orgId).eq("active", true).order("name").limit(500);
      rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, custo_rs: Number(r.cost_cents) / 100 }));
    } else {
      let q = admin.from("inventory_movements").select("kind, quantity, reason, created_at").eq("org_id", session.orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      if (status) q = q.eq("kind", status);
      rows = ((await q).data ?? []) as Record<string, unknown>[];
    }

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
