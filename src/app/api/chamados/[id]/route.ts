import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { TICKET_STATUSES, transition, type TicketStatus } from "@/domain/ticket-states";
import { resolveActors, withActorNames } from "@/lib/actors";
import { notifyUser } from "@/lib/notify";

const paramsSchema = z.object({ id: z.string().uuid() });

// Acoes expostas: transicao de estado valida + conversao registrada.
// A conversao cria o evento e o status CONVERTIDO; a OS/compra real nasce na Fase 05/06.
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), to: z.enum(TICKET_STATUSES), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("convert"), target: z.enum(["os", "compra"]), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("assign"), assigned_to: z.string().uuid().nullable(), client_key: z.string().uuid().optional() }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "tickets", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { data: ticket, error } = await admin
      .from("tickets")
      .select("*")
      .eq("id", id)
      .eq("org_id", session.orgId)
      .single();
    if (error || !ticket) return fail("NOT_FOUND", "Chamado nao encontrado.", 404);
    const { data: events } = await admin
      .from("ticket_events")
      .select("event, from_status, to_status, detail, actor_profile_id, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    const { data: messages } = await admin
      .from("ticket_messages")
      .select("author_kind, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    // Nome do responsável pelo ticket (atribuição).
    let assignee_name: string | null = null;
    if (ticket.assigned_to) {
      const actors = await resolveActors([ticket.assigned_to as string]);
      assignee_name = actors.get(ticket.assigned_to as string)?.name ?? null;
    }
    const named = withActorNames(events ?? [], await resolveActors((events ?? []).map((e) => e.actor_profile_id)));
    return ok({ ticket: { ...ticket, assignee_name }, events: named, messages: messages ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "tickets", "update")) {
      return fail("FORBIDDEN", "Sem permissao para movimentar chamados.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Acao invalida.", 422);

    const admin = createAdminClient();
    // Replay idempotente: evento já aplicado retorna o estado atual sem duplicar.
    const clientKey = (parsed.data as { client_key?: string }).client_key;
    if (clientKey) {
      const { data: seen } = await admin
        .from("ticket_events")
        .select("to_status")
        .eq("ticket_id", id)
        .eq("client_key", clientKey)
        .maybeSingle();
      if (seen) return ok({ id, to: seen.to_status, deduped: true });
    }
    const { data: ticket } = await admin
      .from("tickets")
      .select("id, status, number")
      .eq("id", id)
      .eq("org_id", session.orgId)
      .single();
    if (!ticket) return fail("NOT_FOUND", "Chamado nao encontrado.", 404);

    const from = ticket.status as TicketStatus;
    let to: TicketStatus;
    let event: string;
    let detail: Record<string, unknown> = { actor: session.email };
    if (parsed.data.action === "advance") {
      to = transition(from, parsed.data.to);
      event = to === "RESOLVIDO" ? "RESOLVIDO" : to === "ENCERRADO" ? "ENCERRADO" : "ALTERADO";
    } else if (parsed.data.action === "assign") {
      // Atribuicao nao muda o status; registra quem assumiu e permite trocar depois.
      to = from;
      event = "ATRIBUIDO";
      detail = { ...detail, assigned_to: parsed.data.assigned_to };
      const { error: assignError } = await admin.from("tickets").update({ assigned_to: parsed.data.assigned_to }).eq("id", id);
      if (assignError) return fail("DB_UPDATE", "Nao foi possivel atribuir.", 500);
      if (parsed.data.assigned_to) {
        await notifyUser(admin, session.orgId, {
          userId: parsed.data.assigned_to,
          kind: "ticket_atribuido",
          title: `Chamado #${ticket.number} atribuído a você`,
          link: `/chamados/${id}`,
        });
      }
      await admin.from("ticket_events").insert({
        ticket_id: id,
        event,
        from_status: from,
        to_status: to,
        actor_profile_id: session.userId,
        detail,
        client_key: clientKey ?? null,
      });
      return ok({ id, from, to, assigned_to: parsed.data.assigned_to });
    } else {
      // Conversao: valida como ida a CONVERTIDO; destino registrado para as Fases 05/06.
      to = transition(from, "CONVERTIDO");
      event = "CONVERTIDO";
      detail = { ...detail, convert_to: parsed.data.target, pending_module: parsed.data.target === "os" ? "FASE_05" : "FASE_06" };
    }

    const { error: updateError } = await admin.from("tickets").update({ status: to }).eq("id", id);
    if (updateError) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    await admin.from("ticket_events").insert({
      ticket_id: id,
      event,
      from_status: from,
      to_status: to,
      actor_profile_id: session.userId,
      detail,
      client_key: clientKey ?? null,
    });
    return ok({ id, from, to });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    if (e instanceof Error && e.message.startsWith("Transicao invalida")) {
      return fail("INVALID_TRANSITION", e.message, 422);
    }
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
