import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { verifyBusiness, verifyChain, type BusinessRow, type ChainRow } from "@/lib/audit-chain";

/** D-09 + Fase 29: cadeia de acesso e de negócio (janela recente, 200 por tabela). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (session.role !== "admin" && session.role !== "gestor" && session.role !== "auditor") {
      return fail("FORBIDDEN", "Somente admin/gestor/auditor.", 403);
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("audit_events")
      .select("id, org_id, event, detail, created_at, previous_hash, hash, hash_version")
      .eq("org_id", session.orgId)
      .order("created_at")
      .order("id")
      .limit(5000);
    if (error) return fail("DB_ERROR", "Nao foi possivel ler.", 500);
    const result = verifyChain((data ?? []) as ChainRow[]);

    // Negócio: pais da org + janela recente por tabela.
    const [{ data: tickets }, { data: wos }, { data: reqs }] = await Promise.all([
      admin.from("tickets").select("id").eq("org_id", session.orgId).limit(2000),
      admin.from("work_orders").select("id").eq("org_id", session.orgId).limit(2000),
      admin.from("purchase_requests").select("id").eq("org_id", session.orgId).limit(2000),
    ]);
    const tIds = new Set((tickets ?? []).map((t) => (t as { id: string }).id));
    const wIds = new Set((wos ?? []).map((t) => (t as { id: string }).id));
    const rIds = new Set((reqs ?? []).map((t) => (t as { id: string }).id));
    const [te, we, pe] = await Promise.all([
      admin.from("ticket_events").select("id, ticket_id, event, from_status, to_status, actor_profile_id, detail, created_at, previous_hash, hash, hash_version").order("created_at", { ascending: false }).limit(600),
      admin.from("work_order_events").select("id, work_order_id, event, from_status, to_status, actor_profile_id, detail, created_at, previous_hash, hash, hash_version").order("created_at", { ascending: false }).limit(600),
      admin.from("purchase_events").select("id, request_id, event, from_status, to_status, actor_profile_id, detail, created_at, previous_hash, hash, hash_version").order("created_at", { ascending: false }).limit(600),
    ]);
    const toBiz = (rows: unknown[], pidKey: string): BusinessRow[] =>
      (rows as Record<string, unknown>[] ?? [])
        .filter((r) => {
          const pid = r[pidKey] as string;
          return pidKey === "ticket_id" ? tIds.has(pid) : pidKey === "work_order_id" ? wIds.has(pid) : rIds.has(pid);
        })
        .map((r) => ({
          id: r.id as string,
          parent_id: r[pidKey] as string,
          event: r.event as string,
          from: (r.from_status as string) ?? null,
          to: (r.to_status as string) ?? null,
          actor_id: (r.actor_profile_id as string) ?? null,
          detail: r.detail,
          created_at: r.created_at as string,
          previous_hash: (r.previous_hash as string) ?? null,
          hash: (r.hash as string) ?? null,
          hash_version: Number(r.hash_version ?? 2),
        }));
    const business = verifyBusiness([
      ...toBiz(te?.data ?? [], "ticket_id"),
      ...toBiz(we?.data ?? [], "work_order_id"),
      ...toBiz(pe?.data ?? [], "request_id"),
    ]);
    return ok({ ...result, business });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
