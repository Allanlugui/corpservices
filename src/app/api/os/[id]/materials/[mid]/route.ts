import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { appendPurchaseEvent, appendWorkOrderEvent } from "@/lib/audit-append";
import { notifyRoles } from "@/lib/notify";
import { applyReturn, applyWithdrawal, planReserve } from "@/domain/inventory";

const paramsSchema = z.object({ id: z.string().uuid(), mid: z.string().uuid() });

/**
 * Reserva de materiais F31 (empenho):
 * - reserve: empenha do disponível; falta gera SC automática vinculada à OS.
 * - withdraw: baixa real (físico + empenho) + movimento de saída.
 * - return: devolução formal (físico volta + estorno).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "work_orders", "update")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const { id, mid } = paramsSchema.parse(await params);
    const parsed = z.object({
      op: z.enum(["reserve", "withdraw", "return"]),
      quantity: z.number().positive().max(1000000).optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Operacao invalida.", 422);
    const admin = createAdminClient();
    const { data: wo } = await admin.from("work_orders").select("id, number, status").eq("id", id).eq("org_id", session.orgId).single();
    if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
    const { data: mat } = await admin.from("work_order_materials").select("*").eq("id", mid).eq("work_order_id", id).single();
    if (!mat) return fail("NOT_FOUND", "Material nao encontrado.", 404);
    const m = mat as { id: string; product_id: string | null; product_name: string; quantity: number; unit: string; qty_reserved: number; qty_used: number; status: string };
    if (!m.product_id) return fail("VALIDATION", "Material sem vínculo de produto (item avulso).", 422);
    const { data: prod } = await admin.from("products").select("id, name, quantity, reserved_quantity").eq("id", m.product_id).eq("org_id", session.orgId).single();
    if (!prod) return fail("NOT_FOUND", "Produto nao encontrado.", 404);
    const p = prod as { id: string; name: string; quantity: number; reserved_quantity: number };

    if (parsed.data.op === "reserve") {
      const want = parsed.data.quantity ?? Number(m.quantity);
      let plan: { reserved: number; missing: number };
      try {
        plan = planReserve(Number(p.quantity), Number(p.reserved_quantity), want);
      } catch (e) {
        return fail("VALIDATION", e instanceof Error ? e.message : "Quantidade invalida.", 422);
      }
      await admin.from("products").update({ reserved_quantity: Number(p.reserved_quantity) + plan.reserved }).eq("id", p.id);
      await admin.from("work_order_materials").update({
        qty_reserved: Number(m.qty_reserved) + plan.reserved,
        status: plan.missing > 0 ? "PARCIAL" : "RESERVADO",
      }).eq("id", mid);
      await appendWorkOrderEvent(admin, id, {
        event: "MATERIAL_RESERVADO",
        actorId: session.userId,
        detail: { material_id: mid, reserved: plan.reserved, missing: plan.missing },
      });
      let purchaseId: string | null = null;
      if (plan.missing > 0) {
        // Cenário 2: sem saldo — SC automática vinculada à OS.
        const { data: req } = await admin.from("purchase_requests").insert({
          org_id: session.orgId,
          origin: "WORK_ORDER",
          work_order_id: id,
          status: "SOLICITADA",
          priority: "alta",
          justification: `Reserva OS-${wo.number as number}: faltam ${plan.missing}× ${p.name}`,
          requested_by: session.userId,
        }).select("id, number").single();
        if (req) {
          purchaseId = (req as { id: string }).id;
          await admin.from("purchase_request_items").insert({
            request_id: purchaseId,
            item: p.name,
            quantity: plan.missing,
          });
          await appendPurchaseEvent(admin, purchaseId, {
            event: "SOLICITADA",
            from: null,
            to: "SOLICITADA",
            actorId: session.userId,
            detail: { origin: "os-reserva", work_order_id: id },
          });
          await notifyRoles(admin, session.orgId, ["gestor", "admin", "comprador"], {
            kind: "compra_auto",
            title: `SC automática #${(req as { number: number }).number} (reserva OS-${wo.number as number})`,
            body: `Faltam ${plan.missing}× ${p.name}.`,
            link: `/compras/${purchaseId}`,
          }, session.userId);
        }
      }
      return ok({ reserved: plan.reserved, missing: plan.missing, purchase_id: purchaseId });
    }

    if (parsed.data.op === "withdraw") {
      const qty = parsed.data.quantity ?? Number(m.qty_reserved);
      let next: { quantity: number; reserved: number };
      try {
        next = applyWithdrawal(Number(p.quantity), Number(p.reserved_quantity), qty);
      } catch (e) {
        return fail("INSUFFICIENT", e instanceof Error ? e.message : "Retirada invalida.", 422);
      }
      await admin.from("products").update({ quantity: next.quantity, reserved_quantity: next.reserved }).eq("id", p.id);
      await admin.from("inventory_movements").insert({
        org_id: session.orgId,
        product_id: p.id,
        kind: "saida",
        quantity: qty,
        reason: `Retirada OS-${wo.number as number} (reserva)`,
        work_order_id: id,
        actor_profile_id: session.userId,
      });
      await admin.from("work_order_materials").update({
        qty_used: Number(m.qty_used) + qty,
        qty_reserved: Number(m.qty_reserved) - qty,
        status: "RETIRADO",
      }).eq("id", mid);
      await appendWorkOrderEvent(admin, id, {
        event: "MATERIAL_RETIRADO",
        actorId: session.userId,
        detail: { material_id: mid, quantity: qty },
      });
      return ok({ quantity: next.quantity });
    }

    // return: devolução formal com estorno.
    const qty = parsed.data.quantity ?? Number(m.qty_used);
    let next: { quantity: number; reserved: number };
    try {
      next = applyReturn(Number(p.quantity), Number(p.reserved_quantity), qty);
    } catch (e) {
      return fail("VALIDATION", e instanceof Error ? e.message : "Devolucao invalida.", 422);
    }
    await admin.from("products").update({ quantity: next.quantity, reserved_quantity: next.reserved }).eq("id", p.id);
    await admin.from("inventory_movements").insert({
      org_id: session.orgId,
      product_id: p.id,
      kind: "entrada",
      quantity: qty,
      reason: `Devolução OS-${wo.number as number} (estorno)`,
      work_order_id: id,
      actor_profile_id: session.userId,
    });
    await admin.from("work_order_materials").update({
      qty_used: Number(m.qty_used) - qty,
      qty_reserved: Number(m.qty_reserved) - qty,
      status: "DEVOLVIDO",
    }).eq("id", mid);
    await appendWorkOrderEvent(admin, id, {
      event: "MATERIAL_DEVOLVIDO",
      actorId: session.userId,
      detail: { material_id: mid, quantity: qty },
    });
    return ok({ quantity: next.quantity });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
