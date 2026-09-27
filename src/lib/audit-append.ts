import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase-admin";
import { chainHashV2, stableJson } from "./audit-chain";

/** Append-only D-09: lê último elo da org e insere encadeado. */
export async function appendAuditEvent(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string | null,
  event: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const { data: last } = await admin
    .from("audit_events")
    .select("hash")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = ((last as { hash: string | null } | null)?.hash) ?? "";
  const createdAt = new Date().toISOString();
  await admin.from("audit_events").insert({
    org_id: orgId,
    user_id: userId,
    event,
    detail,
    created_at: createdAt,
    previous_hash: prev,
    hash: chainHashV2(prev, orgId, event, detail, createdAt),
    hash_version: 2,
  });
}

export interface BusinessEventInput {
  event: string;
  from?: string | null;
  to?: string | null;
  actorId?: string | null;
  detail?: Record<string, unknown>;
  clientKey?: string | null;
}

/** Conteúdo v2 de evento de negócio (elo por entidade-pai). */
export function businessHashV2(prev: string, parentId: string, e: BusinessEventInput, createdAt: string): string {
  return createHash("sha256")
    .update(
      `${prev}|${parentId}|${e.event}|${e.from ?? ""}|${e.to ?? ""}|${e.actorId ?? ""}|${stableJson(e.detail ?? {})}|${createdAt}`,
      "utf8",
    )
    .digest("hex");
}

async function lastHash(
  admin: ReturnType<typeof createAdminClient>,
  table: "ticket_events" | "work_order_events" | "purchase_events",
  parentCol: string,
  parentId: string,
): Promise<string> {
  const { data } = await admin
    .from(table)
    .select("hash")
    .eq(parentCol, parentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { hash: string | null } | null)?.hash) ?? "";
}

export async function appendTicketEvent(
  admin: ReturnType<typeof createAdminClient>,
  ticketId: string,
  e: BusinessEventInput,
): Promise<void> {
  const prev = await lastHash(admin, "ticket_events", "ticket_id", ticketId);
  const createdAt = new Date().toISOString();
  await admin.from("ticket_events").insert({
    ticket_id: ticketId,
    event: e.event,
    from_status: e.from ?? null,
    to_status: e.to ?? null,
    actor_profile_id: e.actorId ?? null,
    detail: e.detail ?? {},
    client_key: e.clientKey ?? null,
    created_at: createdAt,
    previous_hash: prev,
    hash: businessHashV2(prev, ticketId, e, createdAt),
    hash_version: 2,
  });
}

export async function appendWorkOrderEvent(
  admin: ReturnType<typeof createAdminClient>,
  workOrderId: string,
  e: BusinessEventInput,
): Promise<void> {
  const prev = await lastHash(admin, "work_order_events", "work_order_id", workOrderId);
  const createdAt = new Date().toISOString();
  await admin.from("work_order_events").insert({
    work_order_id: workOrderId,
    event: e.event,
    from_status: e.from ?? null,
    to_status: e.to ?? null,
    actor_profile_id: e.actorId ?? null,
    detail: e.detail ?? {},
    created_at: createdAt,
    previous_hash: prev,
    hash: businessHashV2(prev, workOrderId, e, createdAt),
    hash_version: 2,
  });
}

export async function appendPurchaseEvent(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
  e: BusinessEventInput,
): Promise<void> {
  const prev = await lastHash(admin, "purchase_events", "request_id", requestId);
  const createdAt = new Date().toISOString();
  await admin.from("purchase_events").insert({
    request_id: requestId,
    event: e.event,
    from_status: e.from ?? null,
    to_status: e.to ?? null,
    actor_profile_id: e.actorId ?? null,
    detail: e.detail ?? {},
    created_at: createdAt,
    previous_hash: prev,
    hash: businessHashV2(prev, requestId, e, createdAt),
    hash_version: 2,
  });
}
