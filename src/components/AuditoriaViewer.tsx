"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "./ui/filterbar";
import { DataTable } from "./ui/table";
import { LoadingState } from "./ui/skeleton";
import { ErrorState } from "./ui/states";
import { Badge } from "./ui/badge";

interface LogRow {
  id: string;
  at: string;
  entidade: string;
  evento: string;
  detalhe: string;
  actor: string;
}

/** Busca viva: filtra à medida que digita (inclui nome do usuário). */
export function AuditoriaViewer() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [entity, setEntity] = useState("todas");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<{ ok: boolean; checked: number; break_at: string | null } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch(`/api/auditoria?entity=${entity}&limit=200`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.logs as LogRow[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [entity]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.evento, r.detalhe, r.actor, r.entidade].some((f) => f.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {chain ? (
          <Badge tone={chain.ok ? "ok" : "blocked"}>
            {chain.ok ? `Cadeia íntegra (${chain.checked})` : `Cadeia QUEBRADA em ${chain.break_at}`}
          </Badge>
        ) : null}
        <button
          type="button"
          disabled={verifying}
          onClick={() => {
            setVerifying(true);
            fetch("/api/auditoria/verify")
              .then(async (res) => {
                const json = await res.json();
                if (!res.ok || json.error) setError(json.error?.message ?? "Falha na verificação.");
                else setChain(json.data);
              })
              .catch(() => setError("Falha de rede."))
              .finally(() => setVerifying(false));
          }}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
        >
          {verifying ? "Verificando…" : "Verificar cadeia (D-09)"}
        </button>
      </div>
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Buscar por usuário, evento, detalhe…">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filtrar por entidade" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="todas">Todas</option>
          <option value="tickets">Chamados</option>
          <option value="os">OS</option>
          <option value="compras">Compras</option>
          <option value="estoque">Estoque</option>
          <option value="acesso">Acesso</option>
        </select>
      </FilterBar>
      {loading ? (
        <LoadingState label="Carregando auditoria…" />
      ) : error ? (
        <ErrorState title="Sem acesso ou falha" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <DataTable
          caption="Trilha de auditoria"
          columns={[
            { key: "at", header: "Quando", render: (r) => <span className="whitespace-nowrap text-xs">{new Date(r.at).toLocaleString("pt-BR")}</span> },
            { key: "entidade", header: "Entidade", render: (r) => <span className="text-xs font-semibold uppercase">{r.entidade}</span> },
            { key: "evento", header: "Evento", render: (r) => <span className="font-medium">{r.evento}</span> },
            { key: "detalhe", header: "Detalhe", render: (r) => <span className="text-slate-600">{r.detalhe || "—"}</span> },
            { key: "actor", header: "Quem", hideOnMobile: true, render: (r) => <span>{r.actor}</span> },
          ]}
          rows={filtered}
          emptyTitle="Nenhum evento"
          emptyDescription={search ? "Nada corresponde à busca." : "Ajuste os filtros."}
        />
      )}
    </div>
  );
}
