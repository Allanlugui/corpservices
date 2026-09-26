import "server-only";
import { createAdminClient } from "./supabase-admin";
import { assertAssigneeInOrg, type FindProfile } from "@/domain/assignment";

export function adminFindProfile(admin: ReturnType<typeof createAdminClient>): FindProfile {
  return async (userId: string) => {
    const { data } = await admin.from("profiles").select("id, org_id").eq("id", userId).single();
    if (!data) return null;
    return { id: data.id as string, org_id: data.org_id as string };
  };
}

export { assertAssigneeInOrg };
