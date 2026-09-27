import "server-only";
import { createAdminClient } from "./supabase-admin";
import { chainHashV2 } from "./audit-chain";

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
