import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { applyMovement } from "@/domain/inventory";
import { resolveActors, withActorNames } from "@/lib/actors";

const paramsSchema = z.object({ id: z.string().uuid() });
const movementSchema = z.object({
  kind: z.enum(["entrada", "saida", "ajuste"]),
  quantity: z.number().positive().max(1000000),
  adjust_to: z.number().min(0).max(1000000).optional(),
  reason: z.string().trim().min(1).max(500),
  batch: z.string().trim().max(60).optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  work_order_id: z.string().uuid().optional(),
  purchase_id: z.string().uuid().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { data: product, error } = await admin.from("products").select("*").eq("id", id).eq("org_id", session.orgId).single();
    if (error || !product) return fail("NOT_FOUND", "Produto nao encontrado.", 404);
    const [{ data: batches }, { data: movements }] = await Promise.all([
      admin.from("product_batches").select("*").eq("product_id", id).order("expires_at", { ascending: true, nullsFirst: false }),
      admin.from("inventory_movements").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    const named = withActorNames(movements ?? [], await resolveActors((movements ?? []).map((m) => m.actor_profile_id)));
    return ok({ product, batches: batches ?? [], movements: named });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    const parsed = z.object({
      name: z.string().trim().min(1).max(160).optional(),
      location: z.string().trim().max(120).nullable().optional(),
      stock_min: z.number().min(0).optional(),
      stock_max: z.number().min(0).optional(),
      cost_cents: z.number().int().min(0).optional(),
      notes: z.string().trim().max(2000).optional(),
      active: z.boolean().optional(),
    }).safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin.from("products").update(parsed.data).eq("id", id).eq("org_id", session.orgId).select("id").single();
    if (error || !data) return fail("NOT_FOUND", "Produto nao encontrado.", 404);
    return ok({ id: data.id });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const parsed = movementSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Movimentacao invalida.", 422, parsed.error.flatten().fieldErrors);
    const admin = createAdminClient();
    const { data: product } = await admin.from("products").select("id, quantity").eq("id", id).eq("org_id", session.orgId).single();
    if (!product) return fail("NOT_FOUND", "Produto nao encontrado.", 404);
    let next: number;
    try {
      next = applyMovement(Number(product.quantity), parsed.data.kind, parsed.data.quantity, parsed.data.adjust_to);
    } catch (e) {
      return fail("INSUFFICIENT", e instanceof Error ? e.message : "Movimentacao invalida.", 422);
    }
    let batchId: string | null = null;
    if (parsed.data.batch || parsed.data.expires_at) {
      const { data: batch } = await admin
        .from("product_batches")
        .insert({
          product_id: id,
          batch: parsed.data.batch ?? null,
          expires_at: parsed.data.expires_at ?? null,
          quantity: parsed.data.kind === "saida" ? 0 : parsed.data.quantity,
        })
        .select("id")
        .single();
      batchId = (batch?.id as string) ?? null;
    }
    const { error: movError } = await admin.from("inventory_movements").insert({
      org_id: session.orgId,
      product_id: id,
      batch_id: batchId,
      kind: parsed.data.kind,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      work_order_id: parsed.data.work_order_id ?? null,
      purchase_id: parsed.data.purchase_id ?? null,
      actor_profile_id: session.userId,
    });
    if (movError) return fail("DB_INSERT", "Nao foi possivel registrar.", 500);
    await admin.from("products").update({ quantity: next }).eq("id", id);
    return ok({ quantity: next }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
