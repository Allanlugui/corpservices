import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

/** KPIs reais do dashboard a partir dos tickets (OS/compras entram nas Fases 05/06). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "tickets", "read")) {
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
      can(session.role, "work_orders", "read")
        ? admin.from("work_orders").select("id, number, title, status").eq("org_id", session.orgId).order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      can(session.role, "purchases", "read")
        ? admin.from("purchase_requests").select("id, number, status").eq("org_id", session.orgId).order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
    ]);
    const openOs = (workOrders ?? []).filter((w) => !["ENCERRADA"].includes(w.status as string)).length;
    const pendingPurchases = (purchases ?? []).filter((p) => !["CONCLUIDA", "CANCELADA", "REJEITADA"].includes(p.status as string)).length;
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
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
