import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

/**
 * Sync bidirecional v1 — direção servidor→cliente (Fase 20).
 * Devolve o que mudou desde `since` (números + último update) para o
 * cliente decidir recarregar. Conflito: servidor vence (outbox já faz
 * isso no push); aqui é detecção, sem auto-merge silencioso.
 */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const parsed = z.object({ since: z.string().datetime({ offset: true }).optional() }).safeParse({
      since: url.searchParams.get("since") ?? undefined,
    });
    if (!parsed.success) return fail("VALIDATION", "Parametro since invalido.", 422);
    const since = parsed.data.since ?? new Date(0).toISOString();
    const admin = createAdminClient();
    const [tickets, os, compras] = await Promise.all([
      admin.from("tickets").select("number, updated_at").eq("org_id", session.orgId).gt("updated_at", since).order("updated_at", { ascending: false }).limit(50),
      admin.from("work_orders").select("number, updated_at").eq("org_id", session.orgId).gt("updated_at", since).order("updated_at", { ascending: false }).limit(50),
      admin.from("purchase_requests").select("number, updated_at").eq("org_id", session.orgId).gt("updated_at", since).order("updated_at", { ascending: false }).limit(50),
    ]);
    const total = (tickets.data?.length ?? 0) + (os.data?.length ?? 0) + (compras.data?.length ?? 0);
    return ok({
      server_now: new Date().toISOString(),
      total,
      tickets: (tickets.data ?? []).map((r) => (r as { number: number }).number),
      work_orders: (os.data ?? []).map((r) => (r as { number: number }).number),
      purchases: (compras.data ?? []).map((r) => (r as { number: number }).number),
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
