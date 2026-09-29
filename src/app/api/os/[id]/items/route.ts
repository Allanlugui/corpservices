import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { getRoleConfig } from "@/app/api/configuracoes/papeis/route";

const paramsSchema = z.object({ id: z.string().uuid() });
const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  requires_photo: z.boolean().optional(),
});
const materialSchema = z.object({
  product_name: z.string().trim().min(1).max(160),
  quantity: z.number().positive().max(1000000),
  unit: z.string().trim().min(1).max(20).default("un"),
  justification: z.string().trim().min(3).max(1000),
  product_id: z.string().uuid().nullable().optional(),
});

async function checkAccess(admin: ReturnType<typeof createAdminClient>, orgId: string, woId: string, userId: string, role: string) {
  const { data: wo } = await admin.from("work_orders").select("id, assigned_to").eq("id", woId).eq("org_id", orgId).single();
  if (!wo) return null;
  if (role === "tecnico" && wo.assigned_to !== userId) return null;
  return wo;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "work_orders", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") ?? "checklist";
    const admin = createAdminClient();
    const wo = await checkAccess(admin, session.orgId, id, session.userId, session.role);
    if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);

    if (kind === "checklist") {
      // Fluxo oficial: checklist é criado pelo gestor no planejamento;
      // técnico executa (marca), não cria.
      if (session.role !== "admin" && session.role !== "gestor") {
        return fail("FORBIDDEN", "Checklist criado pelo gestor no planejamento.", 403);
      }
    }

    if (kind === "material") {
      const parsed = materialSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail("VALIDATION", "Material invalido.", 422);
      const { data, error } = await admin
        .from("work_order_materials")
        .insert({ work_order_id: id, ...parsed.data, product_id: parsed.data.product_id ?? null, created_by: session.userId })
        .select("id")
        .single();
      if (error) return fail("DB_INSERT", "Nao foi possivel registrar.", 500);
      return ok({ id: data.id }, 201);
    }

    const parsed = itemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Item invalido.", 422);
    // Padrão do perfil técnico quando o criador não escolhe (config por perfil).
    const roleCfg = await getRoleConfig(admin, session.orgId, "tecnico");
    const requiresPhoto = parsed.data.requires_photo ?? roleCfg.checklist_foto_default === true;
    const { count } = await admin.from("work_order_checklists").select("id", { count: "exact", head: true }).eq("work_order_id", id);
    const { data, error } = await admin
      .from("work_order_checklists")
      .insert({ work_order_id: id, label: parsed.data.label, requires_photo: requiresPhoto, position: count ?? 0 })
      .select("id")
      .single();
    if (error) return fail("DB_INSERT", "Nao foi possivel registrar.", 500);
    return ok({ id: data.id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "work_orders", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    const parsed = z.object({ item_id: z.string().uuid(), done: z.boolean() }).safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const admin = createAdminClient();
    const wo = await checkAccess(admin, session.orgId, id, session.userId, session.role);
    if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
    const { error } = await admin
      .from("work_order_checklists")
      .update({
        done: parsed.data.done,
        done_by: parsed.data.done ? session.userId : null,
        done_at: parsed.data.done ? new Date().toISOString() : null,
      })
      .eq("id", parsed.data.item_id)
      .eq("work_order_id", id);
    if (error) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
