"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/filterbar";
import { DataTable } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

interface LogRow {
  id: string;
  at: string;
  entidade: string;
  evento: string;
  detalhe: string;
  actor: string;
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [entity, setEntity] = useState("todas");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ entity, limit: "100" });
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    fetch(`/api/auditoria?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.logs as LogRow[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [entity, appliedSearch]);

  return (
    <section>
      <PageHeader title="Auditoria" description="Trilha de eventos do sistema: quem fez, o quê e quando." />
      <FilterBar searchValue={search} onSearch={(v) => setSearch(v)} searchPlaceholder="Buscar evento, detalhe ou ator…">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filtrar por entidade" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="todas">Todas</option>
          <option value="tickets">Chamados</option>
          <option value="os">OS</option>
          <option value="compras">Compras</option>
          <option value="estoque">Estoque</option>
        </select>
        <button type="button" onClick={() => setAppliedSearch(search)} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
          Buscar
        </button>
      </FilterBar>
      {loading ? (
        <LoadingState label="Carregando logs…" />
      ) : error ? (
        <ErrorState title="Sem acesso ou falha" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <DataTable
          caption="Logs de auditoria"
          columns={[
            { key: "at", header: "Quando", render: (r) => <span className="whitespace-nowrap text-xs">{new Date(r.at).toLocaleString("pt-BR")}</span> },
            { key: "entidade", header: "Entidade", render: (r) => <span className="text-xs font-semibold uppercase">{r.entidade}</span> },
            { key: "evento", header: "Evento", render: (r) => <span className="font-medium">{r.evento}</span> },
            { key: "detalhe", header: "Detalhe", render: (r) => <span className="text-slate-600">{r.detalhe || "—"}</span> },
            { key: "actor", header: "Quem", hideOnMobile: true, render: (r) => <span>{r.actor}</span> },
          ]}
          rows={rows}
          emptyTitle="Nenhum evento"
          emptyDescription="Ajuste os filtros."
        />
      )}
    </section>
  );
}
