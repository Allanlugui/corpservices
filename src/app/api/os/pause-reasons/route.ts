import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "work_orders", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("pause_reasons")
      .select("label")
      .eq("org_id", session.orgId)
      .eq("active", true)
      .order("label");
    return ok({ reasons: (data ?? []).map((r) => r.label) });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
