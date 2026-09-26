import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { pageParams } from "@/lib/pagination";

const querySchema = z.object({
  kind: z.enum(["servico", "compra"]).optional(),
  status: z.string().optional(),
  mine: z.enum(["0", "1"]).default("0"),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
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
    const { page, pageSize, from, to } = pageParams({ page: parsed.data.page, page_size: parsed.data.page_size ?? parsed.data.limit });
    let query = admin
      .from("tickets")
      .select("id, number, kind, status, category, priority, requester_name, requester_email, ai_suggested_kind, created_at", { count: "exact" })
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (parsed.data.kind) query = query.eq("kind", parsed.data.kind);
    if (parsed.data.status) query = query.eq("status", parsed.data.status);
    // Solicitante acompanha as próprias solicitações (identificação do portal).
    if (parsed.data.mine === "1") query = query.eq("requester_email", session.email);
    if (parsed.data.search) {
      const q = parsed.data.search.trim();
      if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
      else query = query.ilike("requester_name", `%${q}%`);
    }
    const { data, error, count } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ tickets: data, page, page_size: pageSize, total: count ?? data.length });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
