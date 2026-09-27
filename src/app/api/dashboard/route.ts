import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

/** KPIs reais do dashboard a partir dos tickets (OS/compras entram nas Fases 05/06). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "tickets", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data: tickets } = await admin
      .from("tickets")
      .select("id, number, kind, status, requester_name, created_at")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = tickets ?? [];
    const count = (s: string) => rows.filter((t) => t.status === s).length;
    const { data: events } = await admin
      .from("ticket_events")
      .select("event, ticket_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    const [{ data: workOrders }, { data: purchases }] = await Promise.all([
      canSession(session, "work_orders", "read")
        ? admin.from("work_orders").select("id, number, title, status").eq("org_id", session.orgId).order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      canSession(session, "purchases", "read")
        ? admin.from("purchase_requests").select("id, number, status").eq("org_id", session.orgId).order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
    ]);
    const openOs = (workOrders ?? []).filter((w) => !["ENCERRADA"].includes(w.status as string)).length;
    const pendingPurchases = (purchases ?? []).filter((p) => !["CONCLUIDA", "CANCELADA", "REJEITADA"].includes(p.status as string)).length;
    // FIN-02: snapshot financeiro do mês (estoque valorizado + pedidos).
    let finance: { stock_value_cents: number; orders_open_cents: number; orders_received_cents: number } | null = null;
    if (session.role === "admin" || session.role === "gestor") {
      const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [{ data: prods }, { data: reqs }] = await Promise.all([
        admin.from("products").select("quantity, cost_cents").eq("org_id", session.orgId).eq("active", true).limit(2000),
        admin.from("purchase_requests").select("id").eq("org_id", session.orgId),
      ]);
      const ids = new Set((reqs ?? []).map((r) => r.id as string));
      const { data: orders } = await admin.from("purchase_orders").select("amount_cents, status, request_id").gte("created_at", since).limit(2000);
      const mine = (orders ?? []).filter((o) => ids.has(o.request_id as string));
      finance = {
        stock_value_cents: (prods ?? []).reduce((a, p) => a + Number(p.quantity) * Number(p.cost_cents), 0),
        orders_open_cents: mine.filter((o) => (o.status as string) === "ABERTO").reduce((a, o) => a + Number(o.amount_cents), 0),
        orders_received_cents: mine.filter((o) => (o.status as string) === "RECEBIDO").reduce((a, o) => a + Number(o.amount_cents), 0),
      };
    }
    return ok({
      kpis: {
        novos: count("NOVO"),
        em_atendimento: count("EM_TRIAGEM") + count("EM_ANALISE"),
        resolvidos: count("RESOLVIDO"),
        convertidos: count("CONVERTIDO"),
        os_abertas: openOs,
        compras_pendentes: pendingPurchases,
      },
      recent: rows.slice(0, 8),
      activity: events ?? [],
      work_orders: workOrders ?? [],
      purchases: purchases ?? [],
      finance,
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
