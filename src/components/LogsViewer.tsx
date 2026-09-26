"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "./ui/filterbar";
import { DataTable } from "./ui/table";
import { LoadingState } from "./ui/skeleton";
import { ErrorState } from "./ui/states";
import { Badge } from "./ui/badge";

interface SysLog {
  id: string;
  level: string;
  source: string;
  message: string;
  created_at: string;
}

const TONE: Record<string, string> = { debug: "pending", info: "info", warn: "warn", error: "blocked" };

/** Logs técnicos do sistema (erros, fontes, estados) — separado da auditoria de negócio. */
export function LogsViewer() {
  const [rows, setRows] = useState<SysLog[]>([]);
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (level) params.set("level", level);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/logs?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.logs as SysLog[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [level, search]);

  return (
    <div>
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Buscar mensagem ou fonte…">
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filtrar por nível" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Todos os níveis</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
      </FilterBar>
      {loading ? (
        <LoadingState label="Carregando logs…" />
      ) : error ? (
        <ErrorState title="Sem acesso ou falha" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <DataTable
          caption="Logs do sistema"
          columns={[
            { key: "at", header: "Quando", render: (r) => <span className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</span> },
            { key: "level", header: "Nível", render: (r) => <Badge tone={TONE[r.level] ?? "pending"}>{r.level}</Badge> },
            { key: "source", header: "Fonte", render: (r) => <span className="font-mono text-xs">{r.source}</span> },
            { key: "message", header: "Mensagem", render: (r) => <span className="text-slate-700">{r.message}</span> },
          ]}
          rows={rows}
          emptyTitle="Nenhum log"
          emptyDescription="Ajuste os filtros."
        />
      )}
    </div>
  );
}
