"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { Button, ActionLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/fields";
import { ConfirmDialog } from "@/components/ui/modal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { FileList, FileUploader, useFiles } from "@/components/files";

interface Purchase {
  id: string;
  number: number;
  origin: string;
  status: string;
  priority: string;
  justification: string;
  rejection_reason: string | null;
  ticket_id: string | null;
  work_order_id: string | null;
  origin_label: string | null;
  created_at: string;
}
interface Item {
  id: string;
  item: string;
  description: string;
  quantity: number;
  desired_deadline: string | null;
}
interface Quote {
  id: string;
  supplier: string;
  amount_cents: number;
  currency: string;
  notes: string;
  chosen: boolean;
}
interface Order {
  id: string;
  supplier: string;
  amount_cents: number;
  currency: string;
  status: string;
  delivery_deadline: string | null;
  tracking_code: string | null;
  notes: string;
}
interface Detail {
  purchase: Purchase;
  items: Item[];
  quotes: Quote[];
  orders: Order[];
  events: { event: string; from_status: string | null; to_status: string | null; actor_name: string; created_at: string }[];
}

const ADVANCE: Record<string, { label: string; to: string }[]> = {
  SOLICITADA: [{ label: "Iniciar análise", to: "EM_ANALISE" }],
  EM_ANALISE: [{ label: "Designar comprador", to: "DESIGNADA" }],
  DESIGNADA: [{ label: "Iniciar cotação", to: "COTACAO" }],
  COTACAO: [{ label: "Enviar para aprovação", to: "AGUARDANDO_APROVACAO" }],
  AGUARDANDO_APROVACAO: [],
  APROVADA: [{ label: "Iniciar negociação", to: "NEGOCIACAO" }],
  NEGOCIACAO: [{ label: "Registrar pagamento", to: "PAGAMENTO" }],
  PAGAMENTO: [{ label: "Enviar (em trânsito)", to: "EM_TRANSITO" }],
  EM_TRANSITO: [{ label: "Confirmar recebimento", to: "RECEBIDA" }],
  RECEBIDA: [{ label: "Concluir", to: "CONCLUIDA" }],
  CONCLUIDA: [],
  REJEITADA: [{ label: "Reenviar (volta a solicitada)", to: "SOLICITADA" }],
  CANCELADA: [],
};

function fmtMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function OrderCard({ purchaseId, order: o, onChanged }: { purchaseId: string; order: Order; onChanged: () => void }) {
  const toast = useToast();
  const [deadline, setDeadline] = useState(o.delivery_deadline ?? "");
  const [tracking, setTracking] = useState(o.tracking_code ?? "");
  const [busy, setBusy] = useState(false);
  const { files, reload } = useFiles("purchase", purchaseId);
  const receipts = files.filter((f) => f.folder === "recibo_pagamento");
  const nfs = files.filter((f) => f.folder === "nota_fiscal");

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/compras/${purchaseId}/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_deadline: deadline || null, tracking_code: tracking || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível salvar.", "error");
      else {
        toast("Pedido atualizado.");
        onChanged();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={`${o.supplier} — ${fmtMoney(o.amount_cents, o.currency)}`}
      actions={<Badge tone={o.status === "RECEBIDO" ? "ok" : o.status === "CANCELADO" ? "blocked" : "pending"}>{o.status}</Badge>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Prazo de entrega" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Input label="Rastreio" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Código de rastreio" />
      </div>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void save()} className="mt-2">Salvar tratativa</Button>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-semibold">Recibo de pagamento (COT-01)</p>
          <FileUploader ownerType="purchase" ownerId={purchaseId} folder="recibo_pagamento" folders={["recibo_pagamento"]} accept="image/jpeg,image/png,image/webp,application/pdf" label="Anexar recibo" pasteHint onUploaded={reload} />
          <div className="mt-2"><FileList files={receipts} onDelete={reload} /></div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Nota fiscal do pedido (NF-01)</p>
          <FileList files={nfs} onDelete={reload} />
          <p className="mt-1 text-xs text-slate-500">Anexe pela aba Nota fiscal.</p>
        </div>
      </div>
    </Card>
  );
}

function DetailInner({ id }: { id: string }) {
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ label: string; body: Record<string, unknown> } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [quote, setQuote] = useState({ supplier: "", amount: "", notes: "" });

  function load() {
    fetch(`/api/compras/${id}`)
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
      const res = await fetch(`/api/compras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Ação recusada.", "error");
      else {
        toast(`Compra atualizada: ${label}.`);
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function sendQuote() {
    if (!quote.supplier.trim()) {
      toast("Informe o fornecedor.", "error");
      return;
    }
    const cents = Math.round(Number(quote.amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast("Valor inválido.", "error");
      return;
    }
    const res = await fetch(`/api/compras/${id}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier: quote.supplier.trim(), amount_cents: cents, notes: quote.notes }),
    });
    if (res.ok) {
      setQuote({ supplier: "", amount: "", notes: "" });
      toast("Cotação registrada.");
      load();
    } else toast("Não foi possível registrar.", "error");
  }

  async function chooseQuote(quoteId: string) {
    const res = await fetch(`/api/compras/${id}/quotes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId }),
    });
    if (res.ok) {
      toast("Cotação escolhida.");
      load();
    } else toast("Não foi possível escolher.", "error");
  }

  if (error && !detail) return <ErrorState title="Compra indisponível" description={error} onRetry={() => window.location.reload()} />;
  if (!detail) return <LoadingState label="Carregando compra…" />;
  const { purchase: p, items, quotes, orders, events } = detail;

  return (
    <section>
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Compras", href: "/compras" }, { label: `#${p.number}` }]} />
      <div className="mt-2">
        <PageHeader
          title={`Compra #${p.number}`}
          description={`Origem ${p.origin === "TICKET" ? "cliente" : p.origin === "WORK_ORDER" ? "OS" : "manual"}${p.origin_label ? ` · ${p.origin_label}` : ""} · ${new Date(p.created_at).toLocaleString("pt-BR")}`}
          actions={<><StatusBadge status={p.status} /> <ActionLink href={`/api/pdf?entity=compra&id=${p.id}`}>Baixar PDF</ActionLink></>}
        />
      </div>
      {p.rejection_reason ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
          Rejeitada{p.rejection_reason ? `: ${p.rejection_reason}` : ""} — por {events.find((e) => e.event === "REJEITADA")?.actor_name ?? "gestor"}.
        </p>
      ) : null}
      <Tabs
        tabs={[
          {
            id: "resumo",
            label: "Resumo",
            content: (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Itens" className="lg:col-span-2">
                  <ul className="grid gap-2 text-sm">
                    {items.map((i) => (
                      <li key={i.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="font-semibold">{i.quantity}× {i.item}</p>
                        {i.description ? <p className="text-slate-600">{i.description}</p> : null}
                        {i.desired_deadline ? <p className="text-xs text-slate-500">Prazo desejado: {i.desired_deadline}</p> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm"><strong>Justificativa:</strong> {p.justification}</p>
                  {p.work_order_id ? (
                    <p className="mt-2 text-sm"><Link href={`/os/${p.work_order_id}`} className="font-semibold text-brand-700 hover:underline">→ Ver OS vinculada</Link></p>
                  ) : null}
                </Card>
                <Card title="Ações">
                  <div className="grid gap-2">
                    {(ADVANCE[p.status] ?? []).map((a) => (
                      <Button key={a.to} disabled={busy} onClick={() => setConfirm({ label: a.label, body: { action: "advance", to: a.to } })}>
                        {a.label}
                      </Button>
                    ))}
                    {p.status === "AGUARDANDO_APROVACAO" && (
                      <>
                        <Button disabled={busy} onClick={() => setConfirm({ label: "Aprovar compra", body: { action: "approve" } })}>
                          Aprovar (gestor)
                        </Button>
                        <Textarea label="Motivo da rejeição" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
                        <Button variant="secondary" disabled={busy || rejectReason.trim().length < 3} onClick={() => void act({ action: "reject", reason: rejectReason.trim() }, "Rejeitar")}>
                          Rejeitar com justificativa
                        </Button>
                      </>
                    )}
                    {(p.status === "APROVADA" || p.status === "NEGOCIACAO" || p.status === "PAGAMENTO") && (
                      <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ label: "Trocar fornecedor (volta à cotação)", body: { action: "advance", to: "COTACAO" } })}>
                        Trocar fornecedor
                      </Button>
                    )}
                    {(p.status === "SOLICITADA" || p.status === "EM_ANALISE" || p.status === "DESIGNADA" || p.status === "COTACAO" || p.status === "AGUARDANDO_APROVACAO" || p.status === "APROVADA" || p.status === "NEGOCIACAO" || p.status === "PAGAMENTO") && (
                      <Button variant="danger" disabled={busy} onClick={() => setConfirm({ label: "Cancelar compra", body: { action: "cancel" } })}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: "cotacoes",
            label: `Cotações (${quotes.length})`,
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Cotações recebidas">
                  <ul className="grid gap-2 text-sm">
                    {quotes.map((q) => (
                      <li key={q.id} className={`rounded-lg border p-3 ${q.chosen ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                        <p className="font-semibold">{q.supplier} — {fmtMoney(q.amount_cents, q.currency)} {q.chosen ? "(escolhida)" : ""}</p>
                        {q.notes ? <p className="text-slate-600">{q.notes}</p> : null}
                        {!q.chosen ? (
                          <Button variant="secondary" size="sm" onClick={() => void chooseQuote(q.id)} className="mt-2">Escolher (gestor)</Button>
                        ) : null}
                      </li>
                    ))}
                    {quotes.length === 0 ? <li className="text-slate-500">Nenhuma cotação ainda.</li> : null}
                  </ul>
                </Card>
                <Card title="Nova cotação">
                  <div className="grid gap-3">
                    <Input label="Fornecedor" value={quote.supplier} onChange={(e) => setQuote({ ...quote, supplier: e.target.value })} />
                    <Input label="Valor (R$)" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} inputMode="decimal" placeholder="0,00" />
                    <Textarea label="Observações" value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} rows={2} />
                    <Button variant="secondary" onClick={() => void sendQuote()}>Registrar cotação</Button>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: "pedidos",
            label: `Pedidos (${orders.length})`,
            content: (
              <div className="grid gap-4">
                {orders.map((o) => (
                  <OrderCard key={o.id} purchaseId={id} order={o} onChanged={() => load()} />
                ))}
                {orders.length === 0 ? (
                  <Card title="Pedidos gerados na aprovação">
                    <p className="text-sm text-slate-500">Nenhum pedido (gerado ao aprovar com cotação escolhida).</p>
                  </Card>
                ) : null}
                <p className="text-xs text-slate-500">Pagamento financeiro real: somente com integração configurada (limite arquitetural).</p>
              </div>
            ),
          },
          {
            id: "nf",
            label: "Nota fiscal",
            content: <PurchaseNf purchaseId={id} />,
          },
          {
            id: "historico",
            label: `Histórico (${events.length})`,
            content: (
              <Card title="Linha do tempo">
                <Timeline items={events.map((e) => ({ title: `${e.event}${e.from_status ? ` (${e.from_status} → ${e.to_status})` : ""} — por ${e.actor_name}`, at: e.created_at }))} />
              </Card>
            ),
          },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/compras" className="font-semibold text-brand-700 hover:underline">← Voltar para Compras</Link>
      </p>
      {confirm ? (
        <ConfirmDialog
          title={confirm.label}
          description={`Confirmar "${confirm.label}" na compra #${p.number}?`}
          confirmLabel={confirm.label}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => void act(confirm.body, confirm.label)}
        />
      ) : null}
    </section>
  );
}

function PurchaseNf({ purchaseId }: { purchaseId: string }) {
  const { files, reload } = useFiles("purchase", purchaseId);
  return (
    <div className="grid gap-4">
      <Card title="Anexar NF (física ou por e-mail)">
        <FileUploader ownerType="purchase" ownerId={purchaseId} folder="nota_fiscal" folders={["nota_fiscal", "documentos"]} accept="image/jpeg,image/png,image/webp,application/pdf,text/xml" label="Nota fiscal ou XML" pasteHint onUploaded={reload} />
        <p className="mt-2 text-xs text-slate-500">A NF fica amarrada a esta compra para auditoria; XML importado no estoque também aparece nos Arquivos.</p>
      </Card>
      <Card title="Documentos vinculados">
        <FileList files={files} onDelete={reload} />
      </Card>
    </div>
  );
}

export default function CompraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <DetailInner id={id} />
    </Suspense>
  );
}
