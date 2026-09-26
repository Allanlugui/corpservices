"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filterbar";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

type Tab = "todos" | "servico" | "compra";

interface Ticket {
  id: string;
  number: number;
  kind: string;
  status: string;
  category: string | null;
  priority: string | null;
  requester_name: string;
  created_at: string;
}

const PAGE_SIZE = 10;

function ChamadosInner({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (tab !== "todos") params.set("kind", tab);
    if (status) params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    fetch(`/api/chamados?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else {
          setTickets(json.data.tickets as Ticket[]);
          setTotal(json.data.total as number);
        }
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [tab, page, status, debouncedSearch]);

  const paged = tickets;

  function switchTab(t: Tab) {
    setTab(t);
    setTickets([]);
    setError(null);
    setStatus("");
    setSearch("");
    setPage(1);
    setLoading(true);
  }

  return (
    <section>
      <PageHeader title="Chamados" description="Triagem e acompanhamento dos tickets." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtrar por tipo">
        {(["todos", "servico", "compra"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {t === "todos" ? "Todos" : t === "servico" ? "Serviços" : "Compras"}
          </button>
        ))}
      </div>
      <FilterBar
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por protocolo ou solicitante…"
      >
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Filtrar por status</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">Todos os status</option>
            {["NOVO", "EM_TRIAGEM", "EM_ANALISE", "CONVERTIDO", "RESOLVIDO", "ENCERRADO"].map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      </FilterBar>
      {loading ? (
        <LoadingState label="Carregando chamados…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <DataTable
            caption="Lista de chamados"
            rowHref={(t) => `/chamados/${t.id}`}
            columns={[
              { key: "number", header: "Protocolo", render: (t) => <Link href={`/chamados/${t.id}`} className="font-mono font-bold hover:underline">#{t.number}</Link> },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
              { key: "requester", header: "Solicitante", render: (t) => <span className="font-medium">{t.requester_name}</span> },
              { key: "priority", header: "Prioridade", hideOnMobile: true, render: (t) => <PriorityBadge priority={t.priority} /> },
              { key: "kind", header: "Tipo", hideOnMobile: true, render: (t) => <span className="text-slate-600">{t.kind}</span> },
              { key: "created", header: "Criado em", hideOnMobile: true, render: (t) => <span className="whitespace-nowrap text-slate-600">{new Date(t.created_at).toLocaleString("pt-BR")}</span> },
            ]}
            rows={paged}
            emptyTitle="Nenhum chamado encontrado"
            emptyDescription="Ajuste os filtros ou aguarde novos tickets do portal."
          />
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </section>
  );
}

export default function ChamadosPage() {
  return (
    <Suspense>
      <ChamadosWithParams />
    </Suspense>
  );
}

function ChamadosWithParams() {
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind");
  const initialTab: Tab = kind === "servico" || kind === "compra" ? kind : "todos";
  return <ChamadosInner key={initialTab} initialTab={initialTab} />;
}
