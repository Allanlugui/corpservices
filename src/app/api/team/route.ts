import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

/** Membros da org para atribuição (id, nome, papel). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "tickets", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, role_key")
      .eq("org_id", session.orgId)
      .order("display_name");
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ members: data });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
