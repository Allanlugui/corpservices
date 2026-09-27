import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { type TicketKind } from "@/domain/botia";
import { resolveBotProvider } from "@/lib/gemini";
import { notifyRoles } from "@/lib/notify";
import { appendTicketEvent } from "@/lib/audit-append";

const KIND_VALUES = ["servico", "compra"] as const;

const ticketSchema = z.object({
  kind: z.enum(KIND_VALUES),
  requester_name: z.string().trim().min(2).max(120),
  requester_email: z.string().trim().email().max(160),
  fields: z.record(z.string(), z.string().max(4000)),
  client_key: z.string().uuid().optional(),
  location_id: z.string().uuid().nullable().optional(),
  location_detail: z.string().trim().max(300).default(""),
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

  const bot = resolveBotProvider();
  const triage = await bot.triage({ kind: kind as TicketKind, fields });

  try {
    const admin = createAdminClient();
    const org_id = await resolveOrgId(admin);

    // Idempotência offline: mesma chave retorna o protocolo existente, sem duplicar.
    if (parsed.data.client_key) {
      const { data: existing } = await admin
        .from("tickets")
        .select("id, number, tracking_token, ai_suggested_kind, ai_missing_fields")
        .eq("client_key", parsed.data.client_key)
        .maybeSingle();
      if (existing) {
        return ok({
          number: existing.number,
          tracking_token: existing.tracking_token,
          tracking_url: `/solicitar/acompanhar?token=${existing.tracking_token}`,
          suggested_kind: existing.ai_suggested_kind,
          missing_fields: existing.ai_missing_fields,
          deduped: true,
        });
      }
    }

    // Insert via service_role: o anon nao tem SELECT (leitura publica so via RPC com token),
    // entao o `returning` do insert anonimo falharia. As restricoes da policy
    // `tickets_anon_insert` (kind valido, status NOVO, sem profile) estao espelhadas
    // abaixo e no schema zod; a policy continua valendo para chamadas REST diretas.
    if (requester_profile_id_present(body)) {
      return fail("VALIDATION", "Campos invalidos.", 422);
    }
    // Local informado: valida na org; inválido = ignora (nunca bloqueia o pedido).
    let locationId: string | null = parsed.data.location_id ?? null;
    if (locationId) {
      const { data: loc } = await admin.from("locations").select("id").eq("id", locationId).eq("org_id", org_id).maybeSingle();
      if (!loc) locationId = null;
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
        client_key: parsed.data.client_key ?? null,
        location_id: locationId,
        location_detail: parsed.data.location_detail ?? "",
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
        output: { ...triage, provider: bot.name },
      });
    }
    await appendTicketEvent(admin, ticket.id as string, {
      event: "CRIADO",
      from: null,
      to: "NOVO",
      actorId: null,
      detail: { channel: "portal", ai_suggested_kind: triage.suggestedKind, ai_provider: bot.name },
      clientKey: parsed.data.client_key ?? null,
    });
    await notifyRoles(admin, org_id, ["gestor", "admin"], {
      kind: "ticket_criado",
      title: `Novo ticket #${ticket.number} (${kind})`,
      body: `${requester_name} — ${triage.summary}`,
      link: `/chamados/${ticket.id}`,
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
