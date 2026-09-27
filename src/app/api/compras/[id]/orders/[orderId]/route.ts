import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

const paramsSchema = z.object({ id: z.string().uuid(), orderId: z.string().uuid() });

/** Tratativa do pedido: prazo de entrega, rastreio e observações. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "purchases", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id, orderId } = paramsSchema.parse(await params);
    const parsed = z.object({
      delivery_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      tracking_code: z.string().trim().max(120).nullable().optional(),
      notes: z.string().trim().max(1000).optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { data: req } = await admin.from("purchase_requests").select("id").eq("id", id).eq("org_id", session.orgId).single();
    if (!req) return fail("NOT_FOUND", "Compra nao encontrada.", 404);
    const { error } = await admin.from("purchase_orders").update(parsed.data).eq("id", orderId).eq("request_id", id);
    if (error) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    await admin.from("purchase_events").insert({
      request_id: id,
      event: "PEDIDO_ATUALIZADO",
      actor_profile_id: session.userId,
      detail: { order_id: orderId, ...parsed.data },
    });
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
