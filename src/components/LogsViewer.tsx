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

  function download(kind: "txt" | "csv" | "json") {
    const stamp = new Date().toISOString().slice(0, 10);
    let content: string;
    let mime: string;
    if (kind === "json") {
      content = JSON.stringify(rows, null, 2);
      mime = "application/json";
    } else if (kind === "csv") {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      content = String.fromCharCode(65279) + ["quando;nivel;fonte;mensagem", ...rows.map((r) => [r.created_at, r.level, r.source, r.message].map(esc).join(";"))].join("\n");
      mime = "text/csv; charset=utf-8";
    } else {
      content = rows.map((r) => `[${r.created_at}] ${r.level.toUpperCase()} ${r.source}: ${r.message}`).join("\n");
      mime = "text/plain; charset=utf-8";
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${stamp}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (level) params.set("level", level);
    if (search.trim()) params.set("search", search.trim());
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
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Buscar mensagem ou fonte�?�">
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filtrar por n��vel" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Todos os n��veis</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <button type="button" onClick={() => download("txt")} disabled={rows.length === 0} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40">TXT</button>
        <button type="button" onClick={() => download("csv")} disabled={rows.length === 0} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40">CSV</button>
        <button type="button" onClick={() => download("json")} disabled={rows.length === 0} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40">JSON</button>
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
