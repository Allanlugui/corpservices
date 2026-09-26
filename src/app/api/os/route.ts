import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { getSetting } from "@/app/api/configuracoes/route";

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).default(""),
  priority: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  location: z.string().trim().max(200).optional(),
  ticket_id: z.string().uuid().optional(),
  parent_work_order_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  sla_days: z.number().min(1).max(365).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "work_orders", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const mine = url.searchParams.get("mine") === "1";

    const admin = createAdminClient();
    let query = admin
      .from("work_orders")
      .select("id, number, title, status, priority, assigned_to, sla_remaining_ms, created_at")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (status) query = query.eq("status", status);
    // Tecnico ve as proprias; gestor/admin podem filtrar.
    if (session.role === "tecnico" || mine) query = query.eq("assigned_to", session.userId);
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ work_orders: data });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    // Criar OS e gerir; tecnico executa o que lhe e atribuido.
    if (!can(session.role, "work_orders", "update")) {
      return fail("FORBIDDEN", "Sem permissao para criar OS.", 403);
    }
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422, parsed.error.flatten().fieldErrors);

    const admin = createAdminClient();
    if (parsed.data.ticket_id) {
      const { data: ticket } = await admin
        .from("tickets")
        .select("id, status")
        .eq("id", parsed.data.ticket_id)
        .eq("org_id", session.orgId)
        .single();
      if (!ticket) return fail("NOT_FOUND", "Ticket nao encontrado.", 404);
      if (ticket.status !== "CONVERTIDO") {
        return fail("INVALID_TICKET", "OS nasce de ticket CONVERTIDO.", 422);
      }
    }

    if (parsed.data.parent_work_order_id) {
      const { data: parent } = await admin
        .from("work_orders")
        .select("id, status")
        .eq("id", parsed.data.parent_work_order_id)
        .eq("org_id", session.orgId)
        .single();
      if (!parent) return fail("NOT_FOUND", "OS pai nao encontrada.", 404);
      if (parent.status === "ENCERRADA") {
        return fail("INVALID_PARENT", "OS filha nao nasce de OS encerrada.", 422);
      }
    }

    const slaDays = parsed.data.sla_days ?? (await getSetting(admin, session.orgId, "os_sla_days_default"));
    const slaTotal = Math.round(slaDays * 86_400_000);
    const { data: wo, error } = await admin
      .from("work_orders")
      .insert({
        org_id: session.orgId,
        ticket_id: parsed.data.ticket_id ?? null,
        parent_work_order_id: parsed.data.parent_work_order_id ?? null,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        location: parsed.data.location ?? null,
        assigned_to: parsed.data.assigned_to ?? null,
        created_by: session.userId,
        sla_total_ms: slaTotal,
        sla_remaining_ms: slaTotal,
      })
      .select("id, number")
      .single();
    if (error || !wo) return fail("DB_INSERT", "Nao foi possivel criar a OS.", 500);
    await admin.from("work_order_events").insert({
      work_order_id: wo.id,
      event: "CRIADA",
      from_status: null,
      to_status: "ABERTA",
      actor_profile_id: session.userId,
      detail: { ticket_id: parsed.data.ticket_id ?? null, parent_work_order_id: parsed.data.parent_work_order_id ?? null },
    });
    if (parsed.data.parent_work_order_id) {
      await admin.from("work_order_events").insert({
        work_order_id: parsed.data.parent_work_order_id,
        event: "OS_FILHA_CRIADA",
        actor_profile_id: session.userId,
        detail: { child_id: wo.id, child_number: wo.number },
      });
    }
    return ok({ id: wo.id, number: wo.number }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
