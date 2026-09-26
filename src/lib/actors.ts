import "server-only";
import { createAdminClient } from "./supabase-admin";

export interface ActorInfo {
  id: string;
  name: string;
}

/**
 * Resolve nomes de atores (profiles.display_name + fallback email do Auth)
 * para exibir QUEM fez cada movimentação. Sem isso não há rastreabilidade.
 */
export async function resolveActors(ids: (string | null | undefined)[]): Promise<Map<string, ActorInfo>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, ActorInfo>();
  if (unique.length === 0) return map;
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, display_name").in("id", unique);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string) || ""]));
  await Promise.all(
    unique.map(async (id) => {
      const name = names.get(id) ?? "";
      let email = "";
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        email = data?.user?.email ?? "";
      } catch {
        email = "";
      }
      map.set(id, { id, name: name || email || "usuário removido" });
    }),
  );
  return map;
}

/** Anexa `actor_name` a eventos com `actor_profile_id`. */
export function withActorNames<T extends { actor_profile_id?: string | null }>(
  events: T[],
  actors: Map<string, ActorInfo>,
): (T & { actor_name: string })[] {
  return events.map((e) => ({
    ...e,
    actor_name: (e.actor_profile_id && actors.get(e.actor_profile_id)?.name) || "sistema",
  }));
}
