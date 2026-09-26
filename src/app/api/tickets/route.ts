import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { DeterministicProvider, type TicketKind } from "@/domain/botia";

const KIND_VALUES = ["servico", "compra"] as const;

const ticketSchema = z.object({
  kind: z.enum(KIND_VALUES),
  requester_name: z.string().trim().min(2).max(120),
  requester_email: z.string().trim().email().max(160),
  fields: z.record(z.string(), z.string().max(4000)),
});

/** Rejeita tentativa de vincular profile pelo portal publico (espelha a policy RLS). */
function requester_profile_id_present(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    ("requester_profile_id" in body || "status" in body || "org_id" in body)
  );
}

async function resolveOrgId(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.from("organizations").select("id").limit(1).single();
  if (error || !data) throw new Error("Nenhuma organizacao cadastrada.");
  return data.id as string;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_JSON", "Corpo da requisicao invalido.", 400);
  }
  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION", "Campos invalidos.", 422, parsed.error.flatten().fieldErrors);
  }
  const { kind, requester_name, requester_email, fields } = parsed.data;

  const bot = new DeterministicProvider();
  const triage = await bot.triage({ kind: kind as TicketKind, fields });

  try {
    const admin = createAdminClient();
    const org_id = await resolveOrgId(admin);

    // Insert via service_role: o anon nao tem SELECT (leitura publica so via RPC com token),
    // entao o `returning` do insert anonimo falharia. As restricoes da policy
    // `tickets_anon_insert` (kind valido, status NOVO, sem profile) estao espelhadas
    // abaixo e no schema zod; a policy continua valendo para chamadas REST diretas.
    if (requester_profile_id_present(body)) {
      return fail("VALIDATION", "Campos invalidos.", 422);
    }
    const { data: ticket, error: insertError } = await admin
      .from("tickets")
      .insert({
        org_id,
        kind,
        status: "NOVO",
        requester_name,
        requester_email,
        requester_profile_id: null,
        category: null,
        priority: null,
        ai_suggested_kind: triage.suggestedKind,
        ai_missing_fields: triage.missingFields,
        payload: fields,
      })
      .select("id, number, tracking_token")
      .single();
    if (insertError || !ticket) {
      return fail("DB_INSERT", "Nao foi possivel registrar a solicitacao.", 500);
    }

    // Trilha auditavel (server-side, service_role): conversa + mensagens + acao + evento.
    const { data: conversation } = await admin
      .from("ai_conversations")
      .insert({ org_id, ticket_id: ticket.id, channel: "portal" })
      .select("id")
      .single();
    if (conversation) {
      await admin.from("ai_messages").insert([
        { conversation_id: conversation.id, role: "user", content: JSON.stringify(fields) },
        {
          conversation_id: conversation.id,
          role: "assistant",
          content: `Sugestao: ${triage.suggestedKind}. Faltando: ${triage.missingFields.join(", ") || "nada"}.`,
        },
      ]);
      await admin.from("ai_actions").insert({
        conversation_id: conversation.id,
        action: "triage",
        input: { kind, fields },
        output: triage,
      });
    }
    await admin.from("ticket_events").insert({
      ticket_id: ticket.id,
      event: "CRIADO",
      from_status: null,
      to_status: "NOVO",
      detail: { channel: "portal", ai_suggested_kind: triage.suggestedKind },
    });

    return ok(
      {
        number: ticket.number,
        tracking_token: ticket.tracking_token,
        tracking_url: `/solicitar/acompanhar?token=${ticket.tracking_token}`,
        suggested_kind: triage.suggestedKind,
        missing_fields: triage.missingFields,
      },
      201,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno.";
    return fail("INTERNAL", message, 500);
  }
}
