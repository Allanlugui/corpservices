import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { appendPurchaseEvent } from "@/lib/audit-append";
import { pageParams } from "@/lib/pagination";

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
    if (!canSession(session, "purchases", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const origin = url.searchParams.get("origin");
    const search = url.searchParams.get("search")?.trim();
    const view = url.searchParams.get("view") ?? "requests";
    const { page, pageSize, from, to } = pageParams({
      page: url.searchParams.get("page"),
      page_size: url.searchParams.get("page_size"),
    });
    const admin = createAdminClient();

    if (view === "quotes" || view === "orders") {
      const table = view === "quotes" ? "purchase_quotes" : "purchase_orders";
      const purchaseNumber = url.searchParams.get("purchase_number");
      const supplier = url.searchParams.get("supplier")?.trim().toLowerCase();
      const chosen = url.searchParams.get("chosen");
      const orderStatus = url.searchParams.get("order_status");
      let q = admin
        .from(table)
        .select("*, purchase_requests!inner(number, status, org_id)")
        .eq("purchase_requests.org_id", session.orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (orderStatus && view === "orders") q = q.eq("status", orderStatus);
      if (chosen !== null && chosen !== "" && view === "quotes") q = q.eq("chosen", chosen === "1");
      if (supplier) q = q.ilike("supplier", `%${supplier}%`);
      const { data, error } = await q;
      if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
      let rows = data ?? [];
      if (purchaseNumber) {
        rows = rows.filter(
          (r) => String((r.purchase_requests as unknown as { number: number }).number) === purchaseNumber,
        );
      }
      return ok({ [view]: rows });
    }

    let query = admin
      .from("purchase_requests")
      .select("id, number, origin, status, priority, created_at", { count: "exact" })
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (origin) query = query.eq("origin", origin.toUpperCase());
    if (search && /^\d+$/.test(search)) query = query.eq("number", Number(search));
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    // Primeiro item + total de itens por solicitacao (coluna "Item" da tabela).
    const ids = (data ?? []).map((r) => r.id);
    const itemMap = new Map<string, { first: string; count: number }>();
    if (ids.length > 0) {
      const { data: items } = await admin
        .from("purchase_request_items")
        .select("request_id, item, quantity")
        .in("request_id", ids)
        .order("created_at");
      for (const it of items ?? []) {
        const key = it.request_id as string;
        const cur = itemMap.get(key);
        if (!cur) itemMap.set(key, { first: `${it.quantity}× ${it.item}`, count: 1 });
        else itemMap.set(key, { first: cur.first, count: cur.count + 1 });
      }
    }
    return ok({
      purchases: (data ?? []).map((r) => ({
        ...r,
        first_item: itemMap.get(r.id)?.first ?? "—",
        items_count: itemMap.get(r.id)?.count ?? 0,
      })),
      page,
      page_size: pageSize,
      total: count ?? (data ?? []).length,
    });
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
      if (!canSession(session, "purchases", "create")) return fail("FORBIDDEN", "Sem permissao.", 403);
    }

    if (origin === "os") {
      if (!work_order_id) return fail("VALIDATION", "work_order_id obrigatorio.", 422);
      const { data: wo } = await admin.from("work_orders").select("id, status, assigned_to").eq("id", work_order_id).eq("org_id", session.orgId).single();
      if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
      if (wo.status !== "PAUSADA") return fail("INVALID_OS", "Compra vinculada nasce de OS PAUSADA.", 422);
      const isOwnerTech = session.role === "tecnico" && wo.assigned_to === session.userId;
      if (!isOwnerTech && !canSession(session, "purchases", "create")) {
        return fail("FORBIDDEN", "Sem permissao.", 403);
      }
    }

    if (origin === "manual" && !canSession(session, "purchases", "create")) {
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
    await appendPurchaseEvent(admin, req.id as string, {
      event: "SOLICITADA",
      from: null,
      to: "SOLICITADA",
      actorId: session.userId,
      detail: { origin, ticket_id: ticket_id ?? null, work_order_id: work_order_id ?? null },
    });
    return ok({ id: req.id, number: req.number }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
