import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

/**
 * BI externo (Fase 21): fatos e dimensões em JSON/CSV para PowerBI,
 * Looker ou planilha. Somente admin/gestor. Sem token de integração
 * dedicado nesta v1: usa a sessão (agendador usa CRON_SECRET? não —
 * BI puxa sob demanda com usuário autorizado).
 */
const DATASETS = ["fato_chamados", "fato_os", "fato_compras", "fato_movimentos", "dim_produtos", "dim_fornecedores"] as const;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "sem dados\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const BOM = String.fromCharCode(65279);
  return BOM + [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "reports", "read")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const url = new URL(request.url);
    const parsed = z.object({
      dataset: z.enum(DATASETS),
      format: z.enum(["json", "csv"]).default("json"),
      limit: z.coerce.number().int().min(1).max(5000).default(1000),
    }).safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Dataset invalido.", 422);
    const { dataset, format, limit } = parsed.data;
    const admin = createAdminClient();
    let rows: Record<string, unknown>[] = [];
    if (dataset === "fato_chamados") {
      const { data } = await admin.from("tickets").select("number, kind, status, category, priority, created_at").eq("org_id", session.orgId).order("number", { ascending: false }).limit(limit);
      rows = (data ?? []) as Record<string, unknown>[];
    } else if (dataset === "fato_os") {
      const { data } = await admin.from("work_orders").select("number, status, created_at, updated_at").eq("org_id", session.orgId).order("number", { ascending: false }).limit(limit);
      rows = (data ?? []) as Record<string, unknown>[];
    } else if (dataset === "fato_compras") {
      const { data } = await admin.from("purchase_requests").select("number, origin, status, created_at").eq("org_id", session.orgId).order("number", { ascending: false }).limit(limit);
      rows = (data ?? []) as Record<string, unknown>[];
    } else if (dataset === "fato_movimentos") {
      const { data } = await admin.from("inventory_movements").select("product_id, kind, quantity, reason, created_at, products(name)").eq("org_id", session.orgId).order("created_at", { ascending: false }).limit(limit);
      rows = ((data ?? []) as unknown as { product_id: string; kind: string; quantity: number; reason: string; created_at: string; products: { name: string }[] | null }[]).map((m) => ({
        produto: m.products?.[0]?.name ?? m.product_id, tipo: m.kind, quantidade: m.quantity, motivo: m.reason, em: m.created_at,
      }));
    } else if (dataset === "dim_produtos") {
      const { data } = await admin.from("products").select("name, unit, quantity, cost_cents, barcode, active").eq("org_id", session.orgId).eq("active", true).order("name").limit(limit);
      rows = (data ?? []) as Record<string, unknown>[];
    } else {
      const { data } = await admin.from("suppliers").select("name, doc, contact").eq("org_id", session.orgId).order("name").limit(limit);
      rows = (data ?? []) as Record<string, unknown>[];
    }
    if (format === "csv") {
      return new Response(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bi-${dataset}.csv"`,
        },
      });
    }
    return Response.json({ data: { dataset, rows } });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
