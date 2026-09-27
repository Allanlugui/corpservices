import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { resolveActors } from "@/lib/actors";
import { buildPdf } from "@/lib/pdf";

const querySchema = z.object({
  entity: z.enum(["ticket", "os", "compra", "produto"]),
  id: z.string().uuid(),
});

const PERM: Record<string, [string, string]> = {
  ticket: ["tickets", "read"],
  os: ["work_orders", "read"],
  compra: ["purchases", "read"],
  produto: ["inventory", "read"],
};

/** PDF por entidade: identificação, dados, histórico e trilha de geração. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Parâmetros inválidos.", 422);
    const { entity, id } = parsed.data;
    const [module, action] = PERM[entity] as [string, string];
    if (!canSession(session, module as "tickets", action as "read")) {
      return fail("FORBIDDEN", "Sem permissão.", 403);
    }
    const admin = createAdminClient();

    if (entity === "ticket") {
      const { data: t } = await admin.from("tickets").select("*").eq("id", id).eq("org_id", session.orgId).single();
      if (!t) return fail("NOT_FOUND", "Não encontrado.", 404);
      const { data: events } = await admin.from("ticket_events").select("event, from_status, to_status, actor_profile_id, created_at").eq("ticket_id", id).order("created_at");
      const actors = await resolveActors((events ?? []).map((e) => e.actor_profile_id));
      const bytes = await buildPdf({
        title: `Ticket #${t.number}`,
        subtitle: `${t.kind} · ${t.status}`,
        meta: [["Aberto em", new Date(t.created_at).toLocaleString("pt-BR")], ["Solicitante", `${t.requester_name} · ${t.requester_email}`]],
        generatedBy: session.email,
        sections: [
          {
            title: "Conteúdo",
            table: {
              headers: ["Campo", "Valor"],
              rows: Object.entries((t.payload ?? {}) as Record<string, string>).map(([k, v]) => [k, v]),
            },
          },
          {
            title: "Histórico",
            table: {
              headers: ["Data", "Evento", "Por"],
              rows: (events ?? []).map((e) => [
                new Date(e.created_at as string).toLocaleString("pt-BR"),
                `${e.event}${e.from_status ? ` (${e.from_status}→${e.to_status})` : ""}`,
                actors.get(e.actor_profile_id as string)?.name ?? "sistema",
              ]),
            },
          },
        ],
      });
      return pdfResponse(bytes, `ticket-${t.number}.pdf`);
    }

    if (entity === "os") {
      const { data: w } = await admin.from("work_orders").select("*").eq("id", id).eq("org_id", session.orgId).single();
      if (!w) return fail("NOT_FOUND", "Não encontrada.", 404);
      const [{ data: events }, { data: pauses }, { data: materials }] = await Promise.all([
        admin.from("work_order_events").select("event, from_status, to_status, actor_profile_id, created_at").eq("work_order_id", id).order("created_at"),
        admin.from("work_order_pauses").select("reason, paused_at, resumed_at, duration_ms, sla_before_ms, sla_after_ms").eq("work_order_id", id).order("paused_at"),
        admin.from("work_order_materials").select("product_name, quantity, unit").eq("work_order_id", id),
      ]);
      const actors = await resolveActors((events ?? []).map((e) => e.actor_profile_id));
      const bytes = await buildPdf({
        title: `OS-${String(w.number).padStart(6, "0")} · ${w.title}`,
        subtitle: `${w.status} · prioridade ${w.priority}`,
        meta: [
          ["Local", (w.location as string) ?? "—"],
          ["SLA restante", `${Math.round(Number(w.sla_remaining_ms) / 3600000)}h`],
          ["Início", w.started_at ? new Date(w.started_at as string).toLocaleString("pt-BR") : "—"],
          ["Conclusão", w.finished_at ? new Date(w.finished_at as string).toLocaleString("pt-BR") : "—"],
        ],
        generatedBy: session.email,
        sections: [
          { title: "Descrição", rows: [["Texto", w.description as string]] },
          {
            title: "Pausas",
            table: {
              headers: ["Motivo", "Período"],
              rows: (pauses ?? []).map((p) => [`${p.reason}`, `${new Date(p.paused_at as string).toLocaleString("pt-BR")} → ${p.resumed_at ? new Date(p.resumed_at as string).toLocaleString("pt-BR") : "aberta"}`]),
            },
          },
          {
            title: "Materiais",
            table: {
              headers: ["Material", "Quantidade"],
              rows: (materials ?? []).map((m) => [`${m.product_name}`, `${m.quantity} ${m.unit}`]),
            },
          },
          {
            title: "Histórico",
            table: {
              headers: ["Data", "Evento", "Por"],
              rows: (events ?? []).map((e) => [
                new Date(e.created_at as string).toLocaleString("pt-BR"),
                `${e.event}${e.from_status ? ` (${e.from_status}→${e.to_status})` : ""}`,
                actors.get(e.actor_profile_id as string)?.name ?? "sistema",
              ]),
            },
          },
        ],
      });
      return pdfResponse(bytes, `os-${w.number}.pdf`);
    }

    if (entity === "produto") {
      const { data: pr } = await admin.from("products").select("*").eq("id", id).eq("org_id", session.orgId).single();
      if (!pr) return fail("NOT_FOUND", "Não encontrado.", 404);
      const [{ data: movs }, { data: batches }] = await Promise.all([
        admin.from("inventory_movements").select("kind, quantity, reason, created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(100),
        admin.from("product_batches").select("batch, quantity, expires_at").eq("product_id", id).order("expires_at"),
      ]);
      const bytes = await buildPdf({
        title: `Produto · ${pr.name}`,
        subtitle: `Saldo ${pr.quantity} ${pr.unit} · ${pr.cadastro_incompleto ? "cadastro incompleto" : "cadastro completo"}`,
        meta: [
          ["Custo", `${(Number(pr.cost_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`],
          ["Código de barras", (pr.barcode as string) ?? "—"],
          ["Localização", (pr.location as string) ?? "—"],
        ],
        generatedBy: session.email,
        sections: [
          {
            title: "Lotes",
            table: {
              headers: ["Lote", "Quantidade", "Validade"],
              rows: (batches ?? []).map((b) => [`${b.batch ?? "—"}`, `${b.quantity}`, b.expires_at ? new Date(b.expires_at as string).toLocaleDateString("pt-BR") : "—"]),
            },
          },
          {
            title: "Movimentações",
            table: {
              headers: ["Data", "Tipo", "Qtd", "Motivo"],
              rows: (movs ?? []).map((m) => [
                new Date(m.created_at as string).toLocaleString("pt-BR"),
                `${m.kind}`,
                `${m.quantity}`,
                `${m.reason || ""}`.slice(0, 60),
              ]),
            },
          },
        ],
      });
      return pdfResponse(bytes, `produto-${String(pr.name).replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.pdf`);
    }

    const { data: p } = await admin.from("purchase_requests").select("*").eq("id", id).eq("org_id", session.orgId).single();
    if (!p) return fail("NOT_FOUND", "Não encontrada.", 404);
    const [{ data: items }, { data: quotes }, { data: orders }, { data: events }] = await Promise.all([
      admin.from("purchase_request_items").select("item, quantity, description").eq("request_id", id),
      admin.from("purchase_quotes").select("supplier, amount_cents, currency, chosen").eq("request_id", id),
      admin.from("purchase_orders").select("supplier, amount_cents, currency, status, delivery_deadline, tracking_code").eq("request_id", id).order("created_at"),
      admin.from("purchase_events").select("event, from_status, to_status, actor_profile_id, created_at").eq("request_id", id).order("created_at"),
    ]);
    const actors = await resolveActors((events ?? []).map((e) => e.actor_profile_id));
    const bytes = await buildPdf({
      title: `Compra #${p.number}`,
      subtitle: `${p.status} · origem ${p.origin}`,
      meta: [["Aberta em", new Date(p.created_at).toLocaleString("pt-BR")], ["Justificativa", p.justification as string]],
      generatedBy: session.email,
      sections: [
        {
          title: "Itens",
          table: {
            headers: ["Item", "Quantidade", "Detalhe"],
            rows: (items ?? []).map((i) => [`${i.item}`, `${i.quantity}`, `${i.description || ""}`]),
          },
        },
        {
          title: "Cotações",
          table: {
            headers: ["Fornecedor", "Valor", "Situação"],
            rows: (quotes ?? []).map((q) => [`${q.supplier}`, `${(Number(q.amount_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, q.chosen ? "escolhida" : "cotada"]),
          },
        },
        {
          title: "Pedidos",
          table: {
            headers: ["Fornecedor", "Valor", "Status", "Entrega"],
            rows: (orders ?? []).map((o) => [
              `${o.supplier}`,
              `${(Number(o.amount_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
              `${o.status}`,
              `${o.delivery_deadline ? new Date(o.delivery_deadline as string).toLocaleDateString("pt-BR") : "—"}${o.tracking_code ? ` · ${(o.tracking_code as string)}` : ""}`,
            ]),
          },
        },
        {
          title: "Histórico",
          table: {
            headers: ["Data", "Evento", "Por"],
            rows: (events ?? []).map((e) => [
              new Date(e.created_at as string).toLocaleString("pt-BR"),
              `${e.event}${e.from_status ? ` (${e.from_status}→${e.to_status})` : ""}`,
              actors.get(e.actor_profile_id as string)?.name ?? "sistema",
            ]),
          },
        },
      ],
    });
    return pdfResponse(bytes, `compra-${p.number}.pdf`);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

function pdfResponse(bytes: Uint8Array, filename: string): Response {
  const body = new Uint8Array(bytes);
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
