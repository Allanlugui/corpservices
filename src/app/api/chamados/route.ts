import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const querySchema = z.object({
  kind: z.enum(["servico", "compra"]).optional(),
  status: z.string().optional(),
  mine: z.enum(["0", "1"]).default("0"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "tickets", "read")) {
      return fail("FORBIDDEN", "Sem permissao para ler chamados.", 403);
    }
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);

    const admin = createAdminClient();
    let query = admin
      .from("tickets")
      .select("id, number, kind, status, category, priority, requester_name, requester_email, ai_suggested_kind, created_at")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.kind) query = query.eq("kind", parsed.data.kind);
    if (parsed.data.status) query = query.eq("status", parsed.data.status);
    // Solicitante acompanha as próprias solicitações (identificação do portal).
    if (parsed.data.mine === "1") query = query.eq("requester_email", session.email);
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ tickets: data });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
