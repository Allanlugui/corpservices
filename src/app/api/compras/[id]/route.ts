import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { transitionPurchase, type PurchaseStatus } from "@/domain/purchase-states";
import { resolveActors, withActorNames } from "@/lib/actors";

const paramsSchema = z.object({ id: z.string().uuid() });

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), to: z.enum(["EM_ANALISE", "DESIGNADA", "COTACAO", "AGUARDANDO_APROVACAO", "NEGOCIACAO", "PAGAMENTO", "EM_TRANSITO", "RECEBIDA", "CONCLUIDA"]) }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("resubmit") }),
]);

const ACTION_EVENT: Record<string, string> = {
  advance: "ALTERADA",
  approve: "APROVADA",
  reject: "REJEITADA",
  cancel: "CANCELADA",
  resubmit: "REENVIADA",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "purchases", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { data: req, error } = await admin.from("purchase_requests").select("*").eq("id", id).eq("org_id", session.orgId).single();
    if (error || !req) return fail("NOT_FOUND", "Compra nao encontrada.", 404);
    const [{ data: items }, { data: quotes }, { data: orders }, { data: events }] = await Promise.all([
      admin.from("purchase_request_items").select("*").eq("request_id", id),
      admin.from("purchase_quotes").select("*").eq("request_id", id).order("created_at"),
      admin.from("purchase_orders").select("*").eq("request_id", id).order("created_at"),
      admin.from("purchase_events").select("*").eq("request_id", id).order("created_at"),
    ]);
    const named = withActorNames(events ?? [], await resolveActors((events ?? []).map((e) => e.actor_profile_id)));
    // Origem legivel: numero/titulo do ticket ou da OS vinculada.
    let origin_label: string | null = null;
    if (req.ticket_id) {
      const { data: t } = await admin.from("tickets").select("number").eq("id", req.ticket_id).single();
      if (t) origin_label = `Chamado #${t.number}`;
    }
    if (req.work_order_id) {
      const { data: w } = await admin.from("work_orders").select("number, title").eq("id", req.work_order_id).single();
      if (w) origin_label = `OS-${String(w.number).padStart(6, "0")} · ${w.title}`;
    }
    return ok({ purchase: { ...req, origin_label }, items: items ?? [], quotes: quotes ?? [], orders: orders ?? [], events: named });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "purchases", "update")) {
      return fail("FORBIDDEN", "Sem permissao para movimentar compras.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Acao invalida.", 422);

    const admin = createAdminClient();
    const { data: req } = await admin.from("purchase_requests").select("id, status, work_order_id").eq("id", id).eq("org_id", session.orgId).single();
    if (!req) return fail("NOT_FOUND", "Compra nao encontrada.", 404);
    const from = req.status as PurchaseStatus;
    const detail: Record<string, unknown> = { actor: session.email };
    let to: PurchaseStatus;

    if (parsed.data.action === "approve" || parsed.data.action === "reject") {
      // Aprovar/rejeitar e ato do gestor: IA e tecnico nao decidem.
      if (!can(session.role, "purchases", "approve")) {
        return fail("FORBIDDEN", "Aprovacao exige gestor.", 403);
      }
      if (parsed.data.action === "approve") {
        const { data: chosen } = await admin.from("purchase_quotes").select("id, supplier, amount_cents, currency").eq("request_id", id).eq("chosen", true).maybeSingle();
        if (!chosen) return fail("NO_QUOTE", "Aprovacao exige cotacao escolhida.", 422);
        to = transitionPurchase(from, "APROVADA");
        await admin.from("purchase_orders").insert({
          request_id: id,
          supplier: (chosen as { supplier: string }).supplier,
          amount_cents: (chosen as { amount_cents: number }).amount_cents,
          currency: (chosen as { currency: string }).currency,
          status: "ABERTO",
          created_by: session.userId,
        });
        detail["quote_id"] = (chosen as { id: string }).id;
      } else {
        to = transitionPurchase(from, "REJEITADA");
        detail["rejection_reason"] = parsed.data.reason;
        await admin.from("purchase_requests").update({ rejection_reason: parsed.data.reason }).eq("id", id);
        // Compra da OS rejeitada: OS continua pausada; o tecnico recebe a justificativa no evento.
        if (req.work_order_id) {
          await admin.from("work_order_events").insert({
            work_order_id: req.work_order_id,
            event: "COMPRA_REJEITADA",
            actor_profile_id: session.userId,
            detail: { purchase_id: id, reason: parsed.data.reason },
          });
        }
      }
    } else if (parsed.data.action === "cancel") {
      to = transitionPurchase(from, "CANCELADA");
    } else if (parsed.data.action === "resubmit") {
      to = transitionPurchase(from, "SOLICITADA");
    } else {
      to = transitionPurchase(from, parsed.data.to);
      if (parsed.data.to === "AGUARDANDO_APROVACAO") {
        const { count } = await admin.from("purchase_quotes").select("id", { count: "exact", head: true }).eq("request_id", id);
        if (!count) return fail("NO_QUOTE", "Envie ao menos uma cotacao antes.", 422);
      }
    }

    const { error: updateError } = await admin.from("purchase_requests").update({ status: to }).eq("id", id);
    if (updateError) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    await admin.from("purchase_events").insert({
      request_id: id,
      event: ACTION_EVENT[parsed.data.action],
      from_status: from,
      to_status: to,
      actor_profile_id: session.userId,
      detail,
    });

    // Recebimento de compra vinculada: identifica o componente e avisa na OS (D-16).
    // A retomada e ato do tecnico (botao Retomar), com SLA ainda congelado.
    if (to === "RECEBIDA" && req.work_order_id) {
      await admin.from("work_order_events").insert({
        work_order_id: req.work_order_id,
        event: "COMPONENTE_RECEBIDO",
        actor_profile_id: session.userId,
        detail: { purchase_id: id },
      });
      await admin.from("purchase_orders").update({ status: "RECEBIDO" }).eq("request_id", id);
    }
    if (to === "CONCLUIDA") {
      await admin.from("purchase_requests").update({ updated_at: new Date().toISOString() }).eq("id", id);
    }
    return ok({ id, from, to });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    if (e instanceof Error && e.message.startsWith("Transicao invalida")) {
      return fail("INVALID_TRANSITION", e.message, 422);
    }
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
