import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { resolveActors } from "@/lib/actors";

/**
 * M-03: visor de logs do sistema (Configurações). Somente gestor/admin.
 * Agrega eventos de tickets, OS, compras e estoque para diagnóstico.
 */
const querySchema = z.object({
  entity: z.enum(["tickets", "os", "compras", "estoque", "todas"]).default("todas"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "audit", "read")) {
      return fail("FORBIDDEN", "Auditoria restrita.", 403);
    }
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const admin = createAdminClient();
    const { entity, limit, search } = parsed.data;

    const out: { id: string; at: string; entidade: string; evento: string; detalhe: string; actor: string }[] = [];
    const actorIds: string[] = [];

    if (entity === "todas" || entity === "tickets") {
      const { data } = await admin.from("ticket_events").select("id, created_at, event, from_status, to_status, actor_profile_id").order("created_at", { ascending: false }).limit(limit);
      for (const r of data ?? []) {
        const det = `${r.from_status ?? ""}→${r.to_status ?? ""}`;
        if (search && !(r.event + det).toLowerCase().includes(search.toLowerCase())) continue;
        if (r.actor_profile_id) actorIds.push(r.actor_profile_id as string);
        out.push({ id: r.id as string, at: r.created_at as string, entidade: "ticket", evento: r.event as string, detalhe: det, actor: r.actor_profile_id as string ?? "" });
      }
    }
    if (entity === "todas" || entity === "os") {
      const { data } = await admin.from("work_order_events").select("id, created_at, event, from_status, to_status, actor_profile_id").order("created_at", { ascending: false }).limit(limit);
      for (const r of data ?? []) {
        const det = `${r.from_status ?? ""}→${r.to_status ?? ""}`;
        if (search && !(r.event + det).toLowerCase().includes(search.toLowerCase())) continue;
        if (r.actor_profile_id) actorIds.push(r.actor_profile_id as string);
        out.push({ id: r.id as string, at: r.created_at as string, entidade: "os", evento: r.event as string, detalhe: det, actor: r.actor_profile_id as string ?? "" });
      }
    }
    if (entity === "todas" || entity === "compras") {
      const { data } = await admin.from("purchase_events").select("id, created_at, event, from_status, to_status, actor_profile_id").order("created_at", { ascending: false }).limit(limit);
      for (const r of data ?? []) {
        const det = `${r.from_status ?? ""}→${r.to_status ?? ""}`;
        if (search && !(r.event + det).toLowerCase().includes(search.toLowerCase())) continue;
        if (r.actor_profile_id) actorIds.push(r.actor_profile_id as string);
        out.push({ id: r.id as string, at: r.created_at as string, entidade: "compra", evento: r.event as string, detalhe: det, actor: r.actor_profile_id as string ?? "" });
      }
    }
    if (entity === "todas" || entity === "estoque") {
      const { data } = await admin.from("inventory_movements").select("id, created_at, kind, quantity, reason, actor_profile_id").order("created_at", { ascending: false }).limit(limit);
      for (const r of data ?? []) {
        const det = `${r.quantity} — ${r.reason}`;
        if (search && !((r.kind as string) + det).toLowerCase().includes(search.toLowerCase())) continue;
        if (r.actor_profile_id) actorIds.push(r.actor_profile_id as string);
        out.push({ id: r.id as string, at: r.created_at as string, entidade: "estoque", evento: r.kind as string, detalhe: det, actor: r.actor_profile_id as string ?? "" });
      }
    }
    const actors = await resolveActors(actorIds);
    const rows = out
      .map((r) => ({ ...r, actor: actors.get(r.actor)?.name ?? "sistema" }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, limit);
    return ok({ logs: rows });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
