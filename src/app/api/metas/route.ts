import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

const METRICS = ["chamados_resolvidos", "os_concluidas", "compras_concluidas", "os_no_prazo"] as const;

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function currentValue(admin: ReturnType<typeof createAdminClient>, orgId: string, metric: string): Promise<number> {
  const since = monthStart();
  if (metric === "chamados_resolvidos") {
    const { count } = await admin.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["RESOLVIDO", "ENCERRADO"]).gte("created_at", since);
    return count ?? 0;
  }
  if (metric === "os_concluidas") {
    const { count } = await admin.from("work_orders").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["CONCLUIDA", "VALIDACAO", "ENCERRADA"]).gte("created_at", since);
    return count ?? 0;
  }
  if (metric === "compras_concluidas") {
    const { count } = await admin.from("purchase_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "CONCLUIDA").gte("created_at", since);
    return count ?? 0;
  }
  const { count } = await admin.from("work_orders").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["CONCLUIDA", "VALIDACAO", "ENCERRADA"]).gt("sla_remaining_ms", 0).gte("created_at", since);
  return count ?? 0;
}

export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "reports", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data } = await admin.from("goals").select("*").eq("org_id", session.orgId).eq("active", true).order("created_at");
    const goals = await Promise.all(
      (data ?? []).map(async (g) => ({
        id: g.id,
        name: g.name,
        metric: g.metric,
        target: Number(g.target),
        current: await currentValue(admin, session.orgId, g.metric as string),
      })),
    );
    return ok({ goals, periodo: "mês atual" });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (session.role !== "admin" && session.role !== "gestor") {
      return fail("FORBIDDEN", "Somente gestor/admin.", 403);
    }
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      metric: z.enum(METRICS),
      target: z.number().positive().max(1000000),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("goals")
      .insert({ org_id: session.orgId, ...parsed.data, created_by: session.userId })
      .select("id")
      .single();
    if (error || !data) return fail("DB_INSERT", "Nao foi possivel criar.", 500);
    return ok({ id: data.id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireProfile();
    if (session.role !== "admin" && session.role !== "gestor") {
      return fail("FORBIDDEN", "Somente gestor/admin.", 403);
    }
    const parsed = z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(120).optional(),
      target: z.number().positive().max(1000000).optional(),
      active: z.boolean().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const { id, ...fields } = parsed.data;
    const admin = createAdminClient();
    const { error } = await admin.from("goals").update(fields).eq("id", id).eq("org_id", session.orgId);
    if (error) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
