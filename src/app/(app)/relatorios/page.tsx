"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/filterbar";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Entity = "tickets" | "os" | "compras" | "estoque" | "movimentacoes" | "financeiro";
const ENTITIES: [Entity, string][] = [
  ["tickets", "Chamados"],
  ["os", "OS"],
  ["compras", "Compras"],
  ["estoque", "Estoque"],
  ["movimentacoes", "Movimentações"],
  ["financeiro", "Financeiro"],
];
const PERIODS: [string, string][] = [
  ["dia", "Dia"],
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["trimestre", "Trimestre"],
  ["ano", "Ano"],
  ["tudo", "Tudo"],
];

export default function RelatoriosPage() {
  const toast = useToast();
  const [entity, setEntity] = useState<Entity>("tickets");
  const [periodo, setPeriodo] = useState("mes");
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [produto, setProduto] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function buildParams(extra?: Record<string, string>) {
    const params = new URLSearchParams({ entity, periodo, ...(extra ?? {}) });
    if (status) params.set("status", status);
    if (entity === "tickets" && categoria.trim()) params.set("categoria", categoria.trim());
    if (entity === "tickets" && departamento.trim()) params.set("departamento", departamento.trim());
    if ((entity === "estoque" || entity === "movimentacoes") && produto.trim()) params.set("produto", produto.trim());
    if (entity === "compras" && fornecedor.trim()) params.set("fornecedor", fornecedor.trim());
    return params;
  }

  useEffect(() => {
    fetch(`/api/relatorios?${buildParams().toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.rows as Record<string, unknown>[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, periodo, status, categoria, departamento, produto, fornecedor]);

  function exportCsv() {
    window.open(`/api/relatorios?${buildParams({ format: "csv" }).toString()}`, "_blank", "noopener");
    toast("CSV exportado.");
  }

  function exportPdf() {
    window.open(`/api/relatorios/pdf?${buildParams().toString()}`, "_blank", "noopener");
    toast("PDF gerado.");
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <section>
      <PageHeader
        title="Relatórios"
        description="Filtros por entidade e período, exportação CSV e impressão."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv}>Exportar CSV</Button>
            <Button variant="secondary" size="sm" onClick={exportPdf}>Baixar PDF</Button>
          </>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Entidade">
        {ENTITIES.map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={entity === v}
            onClick={() => { setEntity(v); setStatus(""); }}
            className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${entity === v ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <FilterBar searchPlaceholder="Filtros do relatório">
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          {PERIODS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <input value={status} onChange={(e) => setStatus(e.target.value.toUpperCase())} placeholder="Status exato (opcional)" aria-label="Status exato" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        {entity === "tickets" ? (
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria (opcional)" aria-label="Categoria" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        ) : null}
        {entity === "tickets" ? (
          <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Setor (opcional)" aria-label="Setor" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        ) : null}
        {entity === "estoque" || entity === "movimentacoes" ? (
          <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Produto (opcional)" aria-label="Produto" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        ) : null}
        {entity === "compras" ? (
          <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Fornecedor (opcional)" aria-label="Fornecedor" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        ) : null}
      </FilterBar>
      {loading ? (
        <LoadingState label="Gerando relatório…" />
      ) : error ? (
        <ErrorState title="Não foi possível gerar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="print:block">
          <DataTable
            caption={`Relatório de ${entity}`}
            columns={columns.map((c) => ({
              key: c,
              header: c.replaceAll("_", " "),
              render: (r: Record<string, unknown>) => <span className="text-xs">{String(r[c] ?? "—").slice(0, 60)}</span>,
            }))}
            rows={rows.map((r, i) => ({ id: i, ...r }))}
            emptyTitle="Sem dados"
            emptyDescription="Ajuste entidade, período ou status."
          />
          <p className="mt-2 text-xs text-slate-500 print:hidden">{rows.length} linha(s). Documentos individuais em PDF ficam nos detalhes.</p>
          <details className="mt-4 print:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-brand-700">BI externo (PowerBI/Looker/planilha)</summary>
            <ul className="mt-2 grid gap-1 text-sm">
              {[
                ["fato_chamados", "Chamados"],
                ["fato_os", "Ordens de serviço"],
                ["fato_compras", "Compras"],
                ["fato_movimentos", "Movimentações de estoque"],
                ["dim_produtos", "Produtos"],
                ["dim_fornecedores", "Fornecedores"],
              ].map(([ds, label]) => (
                <li key={ds}>
                  <a className="font-medium text-brand-700 hover:underline" href={`/api/bi/export?dataset=${ds}&format=csv`}>
                    Baixar {label} (CSV)
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
