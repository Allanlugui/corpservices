import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

/** Membros da org para atribuição (id, nome, papel). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "tickets", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, role_key")
      .eq("org_id", session.orgId)
      .order("display_name");
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 });
    const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    return ok({
      members: (data ?? []).map((m) => ({
        ...(m as Record<string, unknown>),
        email: emailById.get((m as { id: string }).id) ?? "",
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
