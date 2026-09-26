"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  created_at: string;
}

const PAGE_SIZE = 10;
const ORIGIN_LABEL: Record<string, string> = { TICKET: "Cliente", WORK_ORDER: "OS", MANUAL: "Manual" };

export default function ComprasPage() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/compras")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.purchases as Purchase[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <section>
      <PageHeader title="Compras" description="Solicitações, cotações, aprovações, pedidos e recebimentos." />
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
      {loading ? (
        <LoadingState label="Carregando compras…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <DataTable
            caption="Lista de compras"
            columns={[
              { key: "number", header: "Nº", render: (t) => <Link href={`/compras/${t.id}`} className="font-mono font-bold hover:underline">#{t.number}</Link> },
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
