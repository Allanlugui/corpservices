import "server-only";
import { createAdminClient } from "./supabase-admin";

export interface NotifyInput {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
}

/** Emissão server-side de notificações in-app (Fase 12 parcial). */
export async function notifyUser(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  input: NotifyInput,
): Promise<void> {
  await admin.from("notifications").insert({
    org_id: orgId,
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? "",
    link: input.link ?? null,
  });
}

export async function notifyRoles(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  roles: string[],
  input: Omit<NotifyInput, "userId">,
  exceptUserId?: string,
): Promise<void> {
  const { data } = await admin.from("profiles").select("id").eq("org_id", orgId).in("role_key", roles);
  const ids = (data ?? []).map((p) => p.id as string).filter((id) => id !== exceptUserId);
  if (ids.length === 0) return;
  await admin.from("notifications").insert(
    ids.map((userId) => ({
      org_id: orgId,
      user_id: userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      link: input.link ?? null,
    })),
  );
}
