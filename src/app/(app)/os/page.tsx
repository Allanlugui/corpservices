"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filterbar";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { formatRemaining } from "@/domain/sla";

interface Wo {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  sla_remaining_ms: number;
  assignee_name: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

export default function OSPage() {
  const [rows, setRows] = useState<Wo[]>([]);
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
    if (status) params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    fetch(`/api/os?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else {
          setRows(json.data.work_orders as Wo[]);
          setTotal(json.data.total as number);
        }
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [page, status, debouncedSearch]);

  const paged = rows;

  return (
    <section>
      <PageHeader
        title="Ordens de Serviço"
        description="Execução, pausas com SLA congelado e validação."
      />
      <FilterBar
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por número ou título…"
      >
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Filtrar por status</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">Todos os status</option>
            {["ABERTA", "ATRIBUIDA", "EM_EXECUCAO", "PAUSADA", "CONCLUIDA", "VALIDACAO", "ENCERRADA"].map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      </FilterBar>
      {loading ? (
        <LoadingState label="Carregando ordens…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <DataTable
            caption="Lista de ordens de serviço"
            rowHref={(t) => `/os/${t.id}`}
            columns={[
              { key: "number", header: "OS", render: (t) => <Link href={`/os/${t.id}`} className="font-mono font-bold hover:underline">OS-{String(t.number).padStart(6, "0")}</Link> },
              { key: "title", header: "Título", render: (t) => <span className="font-medium">{t.title}</span> },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
              { key: "priority", header: "Prioridade", hideOnMobile: true, render: (t) => <PriorityBadge priority={t.priority} /> },
              { key: "sla", header: "SLA restante", render: (t) => <span className="whitespace-nowrap font-mono text-sm">{formatRemaining(t.sla_remaining_ms)}</span> },
              { key: "assignee", header: "Responsável", hideOnMobile: true, render: (t) => <span className="text-sm">{t.assignee_name ?? "—"}</span> },
            ]}
            rows={paged}
            emptyTitle="Nenhuma OS"
            emptyDescription="Técnico vê só as designadas a ele. OS nascem de chamados convertidos ou criadas pelo gestor."
          />
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Nova OS: converta um chamado em OS na tela de Chamados.
      </p>
    </section>
  );
}
