import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const querySchema = z.object({
  periodo: z.enum(["dia", "semana", "mes", "trimestre", "ano"]).default("mes"),
  categoria: z.string().optional(),
});

const PERIOD_MS: Record<string, number> = {
  dia: 86_400_000,
  semana: 7 * 86_400_000,
  mes: 30 * 86_400_000,
  trimestre: 90 * 86_400_000,
  ano: 365 * 86_400_000,
};

/** Métricas honestas do período: entradas, saídas, consumo por produto, saldos críticos. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const since = new Date(Date.now() - PERIOD_MS[parsed.data.periodo]).toISOString();
    const admin = createAdminClient();
    let productIds: string[] | null = null;
    if (parsed.data.categoria) {
      const { data: cats } = await admin.from("product_categories").select("id").eq("org_id", session.orgId).eq("name", parsed.data.categoria);
      const catIds = (cats ?? []).map((c) => c.id as string);
      const { data: prods } = await admin.from("products").select("id").eq("org_id", session.orgId).in("category_id", catIds.length > 0 ? catIds : ["00000000-0000-0000-0000-000000000000"]);
      productIds = (prods ?? []).map((p) => p.id as string);
    }
    let movQuery = admin
      .from("inventory_movements")
      .select("kind, quantity, product_id, created_at")
      .eq("org_id", session.orgId)
      .gte("created_at", since)
      .limit(2000);
    if (productIds) movQuery = movQuery.in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: movs } = await movQuery;
    const rows = movs ?? [];
    const sum = (kind: string) => rows.filter((m) => m.kind === kind).reduce((a, m) => a + Number(m.quantity), 0);
    const byProduct = new Map<string, number>();
    for (const m of rows.filter((m) => m.kind === "saida")) {
      byProduct.set(m.product_id as string, (byProduct.get(m.product_id as string) ?? 0) + Number(m.quantity));
    }
    const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const names = new Map<string, string>();
    if (top.length > 0) {
      const { data: prods } = await admin.from("products").select("id, name, unit").in("id", top.map((t) => t[0]));
      for (const p of prods ?? []) names.set(p.id as string, `${p.name} (${p.unit})`);
    }
    return ok({
      periodo: parsed.data.periodo,
      entradas: sum("entrada"),
      saidas: sum("saida"),
      ajustes: rows.filter((m) => m.kind === "ajuste").length,
      movimentacoes: rows.length,
      mais_consumidos: top.map(([id, qty]) => ({ product_id: id, product: names.get(id) ?? id, quantity: qty })),
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
