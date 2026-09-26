"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filterbar";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/StatCard";

interface Product {
  id: string;
  name: string;
  unit: string;
  location: string | null;
  stock_min: number;
  stock_max: number;
  quantity: number;
  cost_cents: number;
  sku: string | null;
  cadastro_incompleto: boolean;
}
interface Alert {
  type: string;
  product_id: string;
  product: string;
  detail: string;
}

const PAGE_SIZE = 10;
const ALERT_TONE: Record<string, string> = {
  zerado: "blocked", baixo: "warn", excesso: "info", vencido: "blocked", proximo: "warn", incompleto: "pending",
};
const ALERT_LABEL: Record<string, string> = {
  zerado: "Zerado", baixo: "Abaixo do mínimo", excesso: "Acima do máximo",
  vencido: "Vencido", proximo: "Vence em 30 dias", incompleto: "Cadastro incompleto",
};

function level(qty: number, min: number, max: number): string {
  if (qty <= 0) return "zerado";
  if (min > 0 && qty < min) return "baixo";
  if (max > 0 && qty > max) return "excesso";
  return "ok";
}

export default function EstoquePage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<{ entradas: number; saidas: number; movimentacoes: number; mais_consumidos: { product: string; quantity: number }[] } | null>(null);
  const [periodo, setPeriodo] = useState("mes");
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/estoque").then((r) => r.json()),
      fetch("/api/estoque/alertas").then((r) => r.json()),
      fetch(`/api/estoque/metricas?periodo=${periodo}`).then((r) => r.json()),
    ])
      .then(([p, a, m]) => {
        if (p.error) setError(p.error.message);
        else setRows(p.data.products as Product[]);
        if (!a.error) setAlerts(a.data.alerts as Alert[]);
        if (!m.error) setMetrics(m.data);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [periodo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (!alertFilter) return true;
      if (alertFilter === "incompleto") return p.cadastro_incompleto;
      return level(Number(p.quantity), Number(p.stock_min), Number(p.stock_max)) === alertFilter;
    });
  }, [rows, search, alertFilter]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  return (
    <section>
      <PageHeader
        title="Estoque"
        description="Produtos, saldos, validade e movimentações."
        actions={<Link href="/estoque/novo"><Button>Novo produto</Button></Link>}
      />
      {alerts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="status" aria-label="Alertas de estoque">
          {alerts.slice(0, 8).map((a, i) => (
            <Link key={i} href={`/estoque/${a.product_id}`}>
              <Badge tone={ALERT_TONE[a.type] ?? "pending"}>{ALERT_LABEL[a.type] ?? a.type}: {a.product}</Badge>
            </Link>
          ))}
          {alerts.length > 8 ? <Badge tone="pending">+{alerts.length - 8} alertas</Badge> : null}
        </div>
      )}
      <FilterBar searchValue={search} onSearch={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Buscar produto…">
        <select value={alertFilter} onChange={(e) => { setAlertFilter(e.target.value); setPage(1); }} aria-label="Filtrar por alerta" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Todos</option>
          <option value="baixo">Abaixo do mínimo</option>
          <option value="zerado">Zerados</option>
          <option value="excesso">Acima do máximo</option>
          <option value="incompleto">Cadastro incompleto</option>
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período das métricas" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="dia">Hoje</option>
          <option value="semana">Semana</option>
          <option value="mes">Mês</option>
          <option value="trimestre">Trimestre</option>
          <option value="ano">Ano</option>
        </select>
      </FilterBar>
      {metrics && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Entradas" value={String(metrics.entradas)} hint="No período" />
          <StatCard label="Saídas" value={String(metrics.saidas)} hint="Consumo no período" />
          <StatCard label="Movimentações" value={String(metrics.movimentacoes)} hint="Total" />
          <StatCard label="Mais consumido" value={metrics.mais_consumidos[0]?.product.split(" (")[0] ?? "—"} hint={metrics.mais_consumidos[0] ? `${metrics.mais_consumidos[0].quantity} un` : "Sem consumo"} />
        </div>
      )}
      {loading ? (
        <LoadingState label="Carregando estoque…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <DataTable
            caption="Lista de produtos"
            rowHref={(p) => `/estoque/${p.id}`}
            columns={[
              { key: "name", header: "Produto", render: (p) => <span><Link href={`/estoque/${p.id}`} className="font-medium hover:underline">{p.name}</Link>{p.cadastro_incompleto ? <Badge tone="pending"> incompleto</Badge> : null}</span> },
              { key: "qty", header: "Saldo", render: (p) => <span className="font-mono font-bold">{p.quantity} {p.unit}</span> },
              { key: "level", header: "Nível", render: (p) => { const l = level(Number(p.quantity), Number(p.stock_min), Number(p.stock_max)); return l === "ok" ? <span className="text-xs text-slate-500">normal</span> : <Badge tone={ALERT_TONE[l]}>{ALERT_LABEL[l]}</Badge>; } },
              { key: "location", header: "Local", hideOnMobile: true, render: (p) => <span className="text-slate-600">{p.location ?? "—"}</span> },
              { key: "cost", header: "Custo", hideOnMobile: true, render: (p) => <span className="font-mono">{(p.cost_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span> },
            ]}
            rows={paged}
            emptyTitle="Nenhum produto"
            emptyDescription="Cadastre o primeiro produto ou importe via XML de NF-e."
          />
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </section>
  );
}
