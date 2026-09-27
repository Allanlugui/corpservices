import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { verifyChain, type ChainRow } from "@/lib/audit-chain";

/** D-09: verifica a cadeia de auditoria da org (elos + conteúdo v2). */
export async function GET() {
  try {
    const session = await requireProfile();
    if (session.role !== "admin" && session.role !== "gestor" && session.role !== "auditor") {
      return fail("FORBIDDEN", "Somente admin/gestor/auditor.", 403);
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("audit_events")
      .select("id, org_id, event, detail, created_at, previous_hash, hash, hash_version")
      .eq("org_id", session.orgId)
      .order("created_at")
      .order("id")
      .limit(5000);
    if (error) return fail("DB_ERROR", "Nao foi possivel ler.", 500);
    const result = verifyChain((data ?? []) as ChainRow[]);
    return ok(result);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
