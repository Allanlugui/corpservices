"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filterbar";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

interface Purchase {
  id: string;
  number: number;
  origin: string;
  status: string;
  priority: string;
  first_item: string;
  items_count: number;
  created_at: string;
}
interface QuoteRow {
  id: string;
  request_id: string;
  supplier: string;
  amount_cents: number;
  currency: string;
  chosen: boolean;
  created_at: string;
  purchase_requests: { number: number; status: string };
}
interface OrderRow {
  id: string;
  request_id: string;
  supplier: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  purchase_requests: { number: number; status: string };
}

type View = "requests" | "quotes" | "orders";
const PAGE_SIZE = 10;
const ORIGIN_LABEL: Record<string, string> = { TICKET: "Cliente", WORK_ORDER: "OS", MANUAL: "Manual" };

function fmtMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function ComprasInner({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [search, setSearch] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteSupplier, setQuoteSupplier] = useState("");
  const [quoteChosen, setQuoteChosen] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ view });
    if (view === "quotes") {
      if (quoteNumber.trim()) params.set("purchase_number", quoteNumber.trim());
      if (quoteSupplier.trim()) params.set("supplier", quoteSupplier.trim());
      if (quoteChosen) params.set("chosen", quoteChosen);
    }
    if (view === "orders" && orderStatus) params.set("order_status", orderStatus);
    fetch(`/api/compras?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else if (view === "requests") setRows(json.data.purchases as Purchase[]);
        else if (view === "quotes") setQuotes(json.data.quotes as QuoteRow[]);
        else setOrders(json.data.orders as OrderRow[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [view, quoteNumber, quoteSupplier, quoteChosen, orderStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (t) =>
        (!status || t.status === status) &&
        (!origin || t.origin === origin) &&
        (!q || String(t.number).includes(q)),
    );
  }, [rows, status, origin, search]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  function switchView(v: View) {
    setView(v);
    setError(null);
    setStatus("");
    setOrigin("");
    setSearch("");
    setQuoteNumber("");
    setQuoteSupplier("");
    setQuoteChosen("");
    setOrderStatus("");
    setPage(1);
    setLoading(true);
    const url = v === "requests" ? "/compras" : `/compras?view=${v}`;
    window.history.replaceState(null, "", url);
  }

  const quoteGroups = useMemo(() => {
    const map = new Map<number, { requestId: string; status: string; items: QuoteRow[] }>();
    for (const q of quotes) {
      const n = q.purchase_requests.number;
      const g = map.get(n) ?? { requestId: q.request_id, status: q.purchase_requests.status, items: [] };
      g.items.push(q);
      map.set(n, g);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [quotes]);

  return (
    <section>
      <PageHeader title="Compras" description="Solicitações, cotações, aprovações, pedidos e recebimentos." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Visão de compras">
        {([["requests", "Solicitações"], ["quotes", "Cotações"], ["orders", "Pedidos"]] as [View, string][]).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => switchView(v)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${view === v ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "requests" && (
        <FilterBar
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Buscar por número…"
        >
          <select value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }} aria-label="Filtrar por origem" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Todas as origens</option>
            <option value="TICKET">Cliente</option>
            <option value="WORK_ORDER">OS</option>
            <option value="MANUAL">Manual</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filtrar por status" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Todos os status</option>
            {["SOLICITADA", "EM_ANALISE", "DESIGNADA", "COTACAO", "AGUARDANDO_APROVACAO", "APROVADA", "NEGOCIACAO", "PAGAMENTO", "EM_TRANSITO", "RECEBIDA", "CONCLUIDA", "REJEITADA", "CANCELADA"].map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
        </FilterBar>
      )}
      {view === "quotes" && (
        <FilterBar searchPlaceholder="Filtrar cotações">
          <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="Nº da compra" aria-label="Filtrar por número da compra" inputMode="numeric" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
          <input value={quoteSupplier} onChange={(e) => setQuoteSupplier(e.target.value)} placeholder="Fornecedor" aria-label="Filtrar por fornecedor" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
          <select value={quoteChosen} onChange={(e) => setQuoteChosen(e.target.value)} aria-label="Filtrar por situação" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Todas as situações</option>
            <option value="1">Escolhidas</option>
            <option value="0">Cotadas</option>
          </select>
        </FilterBar>
      )}
      {view === "orders" && (
        <FilterBar searchPlaceholder="Filtrar pedidos">
          <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} aria-label="Filtrar por situação do pedido" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Todas as situações</option>
            <option value="ABERTO">Abertos</option>
            <option value="PAGO">Pagos</option>
            <option value="RECEBIDO">Recebidos</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
        </FilterBar>
      )}
      {loading ? (
        <LoadingState label="Carregando compras…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : view === "quotes" ? (
        quoteGroups.length === 0 ? (
          <DataTable
            caption="Cotações agrupadas por compra"
            columns={[{ key: "x", header: "—", render: () => null }]}
            rows={[]}
            emptyTitle="Nenhuma cotação"
            emptyDescription="Ajuste os filtros ou aguarde cotações dos compradores."
          />
        ) : (
          <div className="grid gap-3">
            {quoteGroups.map(([num, group]) => (
              <section key={num} aria-label={`Cotações da compra ${num}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
                <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <Link href={`/compras/${group.requestId}`} className="font-mono font-bold hover:underline">Compra #{num}</Link>
                  <StatusBadge status={group.status} />
                  <span className="text-xs text-slate-500">{group.items.length} cotação(ões)</span>
                </header>
                <ul className="divide-y divide-slate-100">
                  {group.items.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                      <span className="font-medium">{q.supplier}</span>
                      <span className="font-mono">{fmtMoney(q.amount_cents, q.currency)}</span>
                      {q.chosen ? <Badge tone="ok">ESCOLHIDA</Badge> : <Badge tone="pending">COTADA</Badge>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : view === "orders" ? (
        <DataTable
          caption="Pedidos de todas as solicitações"
          columns={[
              { key: "purchase", header: "Compra", render: (o) => <Link href={`/compras/${o.request_id}`} className="font-mono font-bold hover:underline">#{o.purchase_requests.number}</Link> },
              { key: "supplier", header: "Fornecedor", render: (o) => <span className="font-medium">{o.supplier}</span> },
              { key: "amount", header: "Valor", render: (o) => <span className="font-mono">{fmtMoney(o.amount_cents, o.currency)}</span> },
              { key: "status", header: "Pedido", render: (o) => <Badge tone={o.status === "RECEBIDO" ? "ok" : o.status === "CANCELADO" ? "blocked" : "pending"}>{o.status}</Badge> },
              { key: "purchase_status", header: "Solicitação", hideOnMobile: true, render: (o) => <StatusBadge status={o.purchase_requests.status} /> },
            ]}
          rows={orders}
          emptyTitle="Nenhum pedido"
          emptyDescription="Pedidos são gerados ao aprovar com cotação escolhida."
        />
      ) : (
        <>
          <DataTable
            caption="Lista de compras"
            columns={[
              { key: "number", header: "Nº", render: (t) => <Link href={`/compras/${t.id}`} className="font-mono font-bold hover:underline">#{t.number}</Link> },
              { key: "item", header: "Item", render: (t) => <span className="font-medium">{t.first_item}{t.items_count > 1 ? <span className="text-slate-500"> +{t.items_count - 1}</span> : null}</span> },
              { key: "origin", header: "Origem", render: (t) => <Badge tone="info">{ORIGIN_LABEL[t.origin] ?? t.origin}</Badge> },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
              { key: "priority", header: "Prioridade", hideOnMobile: true, render: (t) => <PriorityBadge priority={t.priority} /> },
              { key: "created", header: "Criada em", hideOnMobile: true, render: (t) => <span className="whitespace-nowrap text-slate-600">{new Date(t.created_at).toLocaleString("pt-BR")}</span> },
            ]}
            rows={paged}
            emptyTitle="Nenhuma compra"
            emptyDescription="Compras nascem de chamados convertidos ou de OS pausadas."
          />
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </section>
  );
}

export default function ComprasPage() {
  return (
    <Suspense>
      <ComprasWithParams />
    </Suspense>
  );
}

function ComprasWithParams() {
  const searchParams = useSearchParams();
  const v = searchParams.get("view");
  const initial: View = v === "quotes" || v === "orders" ? v : "requests";
  return <ComprasInner key={initial} initialView={initial} />;
}
