"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Input, Textarea } from "@/components/ui/fields";

interface Detail {
  ticket: {
    id: string;
    number: number;
    kind: string;
    status: string;
    requester_name: string;
    requester_email: string;
    category: string | null;
    priority: string | null;
    payload: Record<string, string>;
    ai_suggested_kind: string | null;
    ai_missing_fields: string[];
    assignee_name: string | null;
    created_at: string;
  };
  events: { event: string; from_status: string | null; to_status: string | null; detail: Record<string, unknown>; actor_name: string; created_at: string }[];
}

const NEXT: Record<string, { label: string; to: string }[]> = {
  NOVO: [{ label: "Iniciar triagem", to: "EM_TRIAGEM" }],
  EM_TRIAGEM: [
    { label: "Enviar para análise", to: "EM_ANALISE" },
    { label: "Resolver direto", to: "RESOLVIDO" },
  ],
  EM_ANALISE: [
    { label: "Devolver para triagem", to: "EM_TRIAGEM" },
    { label: "Resolver", to: "RESOLVIDO" },
  ],
  RESOLVIDO: [
    { label: "Encerrar", to: "ENCERRADO" },
    { label: "Reabrir análise", to: "EM_ANALISE" },
  ],
  CONVERTIDO: [{ label: "Encerrar", to: "ENCERRADO" }],
  ENCERRADO: [],
};

function AssignPicker({ onAssign, busy }: { onAssign: (id: string | null) => void; busy: boolean }) {
  const [members, setMembers] = useState<{ id: string; display_name: string | null; role_key: string }[]>([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    fetch("/api/team")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && !json.error) setMembers(json.data.members);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="grid gap-2 border-t border-slate-100 pt-2">
      <label className="block text-sm font-medium">
        Designar responsável
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name ?? "?"} ({m.role_key})</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={busy || !value} onClick={() => onAssign(value || null)}>
          Designar
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onAssign(null)}>
          Remover
        </Button>
      </div>
    </div>
  );
}

function NewPurchaseFromTicket({
  ticketId,
  defaultItem,
  defaultJustification,
  onCreated,
}: {
  ticketId: string;
  defaultItem: string;
  defaultJustification: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [item, setItem] = useState(defaultItem);
  const [quantity, setQuantity] = useState("1");
  const [justification, setJustification] = useState(defaultJustification);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!item.trim() || justification.trim().length < 3) {
      toast("Preencha item e justificativa.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "ticket",
          ticket_id: ticketId,
          justification: justification.trim(),
          items: [{ item: item.trim(), quantity: Number(quantity) || 1 }],
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível criar.", "error");
      else {
        toast(`Solicitação de compra #${json.data.number} criada.`);
        onCreated();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Input label="Item" value={item} onChange={(e) => setItem(e.target.value)} />
      <Input label="Quantidade" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
      <Textarea label="Justificativa" value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />
      <Button variant="secondary" disabled={busy} onClick={() => void create()}>
        Criar solicitação
      </Button>
    </div>
  );
}

export default function ChamadoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ label: string; body: Record<string, unknown> } | null>(null);

  function load() {
    fetch(`/api/chamados/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setDetail(json.data as Detail);
      })
      .catch(() => setError("Falha de rede."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error?.message ?? "Ação recusada.", "error");
      } else {
        toast(`Chamado atualizado: ${label}.`);
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (error && !detail) return <ErrorState title="Chamado indisponível" description={error} onRetry={() => window.location.reload()} />;
  if (!detail) return <LoadingState label="Carregando chamado…" />;
  const { ticket, events } = detail;

  return (
    <section>
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Chamados", href: "/chamados" }, { label: `#${ticket.number}` }]} />
      <div className="mt-2">
        <PageHeader
          title={`Chamado #${ticket.number}`}
          description={`${ticket.requester_name} · ${ticket.requester_email} · ${new Date(ticket.created_at).toLocaleString("pt-BR")}`}
          actions={<StatusBadge status={ticket.status} />}
        />
      </div>
      <Tabs
        tabs={[
          {
            id: "resumo",
            label: "Resumo",
            content: (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Solicitação" className="lg:col-span-2">
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-500">Tipo</dt><dd className="font-medium">{ticket.kind}</dd></div>
                    <div><dt className="text-slate-500">Sugestão da IA</dt><dd className="font-medium">{ticket.ai_suggested_kind ?? "—"}</dd></div>
                    <div><dt className="text-slate-500">Categoria</dt><dd className="font-medium">{ticket.category ?? "—"}</dd></div>
                    <div><dt className="text-slate-500">Prioridade</dt><dd className="font-medium">{ticket.priority ?? "—"}</dd></div>
                  </dl>
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                    {Object.entries(ticket.payload).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
                  </ul>
                  {ticket.ai_missing_fields.length > 0 ? (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      A triagem sugere completar: {ticket.ai_missing_fields.join(", ")}.
                    </p>
                  ) : null}
                </Card>
                <Card title="Ações do gestor">
                  <p className="mb-2 text-sm text-slate-600">
                    Responsável: <strong>{ticket.assignee_name ?? "não atribuído"}</strong>
                  </p>
                  <div className="grid gap-2">
                    {(NEXT[ticket.status] ?? []).map((a) => (
                      <Button key={a.to} disabled={busy} onClick={() => setConfirm({ label: a.label, body: { action: "advance", to: a.to } })}>
                        {a.label}
                      </Button>
                    ))}
                    <AssignPicker
                      onAssign={(assigned_to) => void act({ action: "assign", assigned_to }, assigned_to ? "Atribuir" : "Remover atribuição")}
                      busy={busy}
                    />
                    {(ticket.status === "EM_ANALISE" || ticket.status === "EM_TRIAGEM") && (
                      <>
                        <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ label: "Converter em OS", body: { action: "convert", target: "os" } })}>
                          Converter em OS
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ label: "Converter em compra", body: { action: "convert", target: "compra" } })}>
                          Converter em compra
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Conversão registra o destino; a OS nasce na tela de OS e a compra no formulário abaixo.</p>
                  {ticket.status === "CONVERTIDO" && events.some((e) => e.detail?.convert_to === "compra") && (
                    <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold">Criar solicitação de compra</p>
                      <NewPurchaseFromTicket
                        ticketId={ticket.id}
                        defaultItem={ticket.payload.item ?? ticket.payload.descricao ?? ""}
                        defaultJustification={`Chamado #${ticket.number} — ${ticket.requester_name}`}
                        onCreated={() => load()}
                      />
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            id: "historico",
            label: `Histórico (${events.length})`,
            content: (
              <Card title="Linha do tempo">
                <Timeline
                  items={events.map((e) => ({
                    title: `${e.event}${e.from_status ? ` (${e.from_status} → ${e.to_status})` : ""} — por ${e.actor_name}`,
                    detail: typeof e.detail?.convert_to === "string" ? `Destino: ${e.detail.convert_to}` : undefined,
                    at: e.created_at,
                  }))}
                />
              </Card>
            ),
          },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/chamados" className="font-semibold text-brand-700 hover:underline">← Voltar para Chamados</Link>
      </p>
      {confirm ? (
        <ConfirmDialog
          title={confirm.label}
          description={`Confirmar "${confirm.label}" no chamado #${ticket.number}? O evento fica registrado no histórico.`}
          confirmLabel={confirm.label}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => void act(confirm.body, confirm.label)}
        />
      ) : null}
    </section>
  );
}
