import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const itemSchema = z.object({
  item: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  quantity: z.number().positive().max(1000000).default(1),
  desired_deadline: z.string().trim().max(120).optional(),
});

const createSchema = z.object({
  origin: z.enum(["ticket", "os", "manual"]),
  ticket_id: z.string().uuid().optional(),
  work_order_id: z.string().uuid().optional(),
  priority: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  justification: z.string().trim().min(3).max(2000),
  items: z.array(itemSchema).min(1).max(50),
});

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "purchases", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const origin = url.searchParams.get("origin");
    const admin = createAdminClient();
    let query = admin
      .from("purchase_requests")
      .select("id, number, origin, status, priority, created_at")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (status) query = query.eq("status", status);
    if (origin) query = query.eq("origin", origin.toUpperCase());
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ purchases: data });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422, parsed.error.flatten().fieldErrors);
    const { origin, ticket_id, work_order_id, priority, justification, items } = parsed.data;
    const admin = createAdminClient();

    if (origin === "ticket") {
      if (!ticket_id) return fail("VALIDATION", "ticket_id obrigatorio.", 422);
      const { data: ticket } = await admin.from("tickets").select("id, status").eq("id", ticket_id).eq("org_id", session.orgId).single();
      if (!ticket) return fail("NOT_FOUND", "Ticket nao encontrado.", 404);
      if (ticket.status !== "CONVERTIDO") return fail("INVALID_TICKET", "Compra nasce de ticket CONVERTIDO.", 422);
      if (!can(session.role, "purchases", "create")) return fail("FORBIDDEN", "Sem permissao.", 403);
    }

    if (origin === "os") {
      if (!work_order_id) return fail("VALIDATION", "work_order_id obrigatorio.", 422);
      const { data: wo } = await admin.from("work_orders").select("id, status, assigned_to").eq("id", work_order_id).eq("org_id", session.orgId).single();
      if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
      if (wo.status !== "PAUSADA") return fail("INVALID_OS", "Compra vinculada nasce de OS PAUSADA.", 422);
      const isOwnerTech = session.role === "tecnico" && wo.assigned_to === session.userId;
      if (!isOwnerTech && !can(session.role, "purchases", "create")) {
        return fail("FORBIDDEN", "Sem permissao.", 403);
      }
    }

    if (origin === "manual" && !can(session.role, "purchases", "create")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }

    const { data: req, error } = await admin
      .from("purchase_requests")
      .insert({
        org_id: session.orgId,
        origin: origin === "ticket" ? "TICKET" : origin === "os" ? "WORK_ORDER" : "MANUAL",
        ticket_id: ticket_id ?? null,
        work_order_id: work_order_id ?? null,
        priority,
        justification,
        requested_by: session.userId,
      })
      .select("id, number")
      .single();
    if (error || !req) return fail("DB_INSERT", "Nao foi possivel criar.", 500);
    await admin.from("purchase_request_items").insert(
      items.map((i) => ({ request_id: req.id, ...i })),
    );
    await admin.from("purchase_events").insert({
      request_id: req.id,
      event: "SOLICITADA",
      from_status: null,
      to_status: "SOLICITADA",
      actor_profile_id: session.userId,
      detail: { origin, ticket_id: ticket_id ?? null, work_order_id: work_order_id ?? null },
    });
    return ok({ id: req.id, number: req.number }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
