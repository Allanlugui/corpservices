"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Timeline } from "@/components/ui/timeline";
import { useMe } from "@/hooks/useMe";
import { formatRemaining } from "@/domain/sla";

interface DashboardData {
  kpis: { novos: number; em_atendimento: number; resolvidos: number; convertidos: number; os_abertas: number; compras_pendentes: number };
  recent: { id: string; number: number; kind: string; status: string; requester_name: string; created_at: string }[];
  activity: { event: string; created_at: string }[];
  work_orders: { id: string; number: number; title: string; status: string }[];
  purchases: { id: string; number: number; status: string }[];
  finance: { stock_value_cents: number; orders_open_cents: number; orders_received_cents: number } | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

async function getJson(path: string) {
  const res = await fetch(path);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Falha");
  return json.data;
}

function useFetch<T>(path: string | null): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!path) return;
    getJson(path)
      .then((d) => setData(d as T))
      .catch(() => setError(true));
  }, [path]);
  return { data, error };
}

function GestorDashboard({ name }: { name: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json.data as DashboardData);
      })
      .catch(() => setError(true));
  }, []);

  const fmtRs = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section>
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} description="Operação de hoje: chamados, SLA e atividade recente." />
      {error ? (
        <ErrorState title="Não foi possível carregar o painel" description="Verifique a conexão e tente novamente." onRetry={() => window.location.reload()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Carregando painel">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Novos" value={String(data.kpis.novos)} hint="Aguardando triagem" />
            <StatCard label="Em atendimento" value={String(data.kpis.em_atendimento)} hint="Triagem + análise" />
            <StatCard label="OS abertas" value={String(data.kpis.os_abertas)} hint="Não encerradas" />
            <StatCard label="Compras pendentes" value={String(data.kpis.compras_pendentes)} hint="Em andamento" />
          </div>
          {data.finance ? (
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="Estoque valorizado" value={fmtRs(data.finance.stock_value_cents)} hint="Qtd × custo" />
              <StatCard label="Pedidos abertos (mês)" value={fmtRs(data.finance.orders_open_cents)} hint="A pagar" />
              <StatCard label="Recebidos (mês)" value={fmtRs(data.finance.orders_received_cents)} hint="Entraram" />
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card title="Chamados recentes" className="xl:col-span-2" actions={<Link href="/chamados" className="text-sm font-semibold text-brand-700 hover:underline">Ver todos</Link>}>
              {data.recent.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum chamado ainda. Novos tickets do portal aparecem aqui.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recent.map((t) => (
                    <li key={t.id}>
                      <Link href={`/chamados/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-slate-50">
                        <span className="font-mono text-sm font-bold">#{t.number}</span>
                        <StatusBadge status={t.status} />
                        <span className="min-w-0 flex-1 truncate text-sm">{t.requester_name}</span>
                        <span className="text-xs text-slate-500">{t.kind}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Atividade recente">
              <Timeline items={data.activity.map((a) => ({ title: a.event, at: a.created_at }))} />
            </Card>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Ordens de Serviço" actions={<Link href="/os" className="text-sm font-semibold text-brand-700 hover:underline">Ver todas</Link>}>
              {data.work_orders.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma OS. Chamados convertidos viram OS aqui.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.work_orders.map((w) => (
                    <li key={w.id}>
                      <Link href={`/os/${w.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-slate-50">
                        <span className="font-mono text-sm font-bold">OS-{String(w.number).padStart(6, "0")}</span>
                        <StatusBadge status={w.status} />
                        <span className="min-w-0 flex-1 truncate text-sm">{w.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Compras" actions={<Link href="/compras" className="text-sm font-semibold text-brand-700 hover:underline">Ver todas</Link>}>
              {data.purchases.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma solicitação.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.purchases.map((p) => (
                    <li key={p.id}>
                      <Link href={`/compras/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-slate-50">
                        <span className="font-mono text-sm font-bold">#{p.number}</span>
                        <StatusBadge status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function TecnicoDashboard({ name }: { name: string }) {
  const { data, error } = useFetch<{ work_orders: { id: string; number: number; title: string; status: string; sla_remaining_ms: number }[] }>("/api/os?mine=1");
  const rows = data?.work_orders ?? [];
  const paused = rows.filter((w) => w.status === "PAUSADA").length;
  const active = rows.filter((w) => ["ATRIBUIDA", "EM_EXECUCAO"].includes(w.status)).length;
  return (
    <section>
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} description="Suas ordens de serviço, prioridades e SLA." />
      {error ? (
        <ErrorState title="Não foi possível carregar" description="Tente novamente." onRetry={() => window.location.reload()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" role="status" aria-label="Carregando"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Em execução" value={String(active)} hint="Atribuídas + executando" />
            <StatCard label="Pausadas" value={String(paused)} hint="SLA congelado" />
            <StatCard label="Minhas OS" value={String(rows.length)} hint="Total" />
          </div>
          <Card title="Minhas ordens" className="mt-4" actions={<Link href="/os" className="text-sm font-semibold text-brand-700 hover:underline">Ver todas</Link>}>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma OS atribuída a você.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((w) => (
                  <li key={w.id}>
                    <Link href={`/os/${w.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-slate-50">
                      <span className="font-mono text-sm font-bold">OS-{String(w.number).padStart(6, "0")}</span>
                      <StatusBadge status={w.status} />
                      <span className="min-w-0 flex-1 truncate text-sm">{w.title}</span>
                      <span className="font-mono text-xs">SLA {formatRemaining(w.sla_remaining_ms)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function CompradorDashboard({ name }: { name: string }) {
  const { data, error } = useFetch<{ purchases: { id: string; number: number; origin: string; status: string }[] }>("/api/compras");
  const rows = data?.purchases ?? [];
  const awaiting = rows.filter((p) => p.status === "AGUARDANDO_APROVACAO").length;
  const quoting = rows.filter((p) => p.status === "COTACAO").length;
  const transit = rows.filter((p) => ["APROVADA", "NEGOCIACAO", "PAGAMENTO", "EM_TRANSITO"].includes(p.status)).length;
  return (
    <section>
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} description="Cotações, aprovações e recebimentos." />
      {error ? (
        <ErrorState title="Não foi possível carregar" description="Tente novamente." onRetry={() => window.location.reload()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" role="status" aria-label="Carregando"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Em cotação" value={String(quoting)} hint="A cotar" />
            <StatCard label="Aguardando aprovação" value={String(awaiting)} hint="No gestor" />
            <StatCard label="Em andamento" value={String(transit)} hint="Aprovada → trânsito" />
          </div>
          <Card title="Compras recentes" className="mt-4" actions={<Link href="/compras" className="text-sm font-semibold text-brand-700 hover:underline">Ver todas</Link>}>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma solicitação.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link href={`/compras/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-slate-50">
                      <span className="font-mono text-sm font-bold">#{p.number}</span>
                      <StatusBadge status={p.status} />
                      <span className="text-xs text-slate-500">{p.origin}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function EstoqueDashboard({ name }: { name: string }) {
  const { data: alertsData } = useFetch<{ alerts: { type: string; product_id: string; product: string; detail: string }[] }>("/api/estoque/alertas");
  const { data: metrics, error } = useFetch<{ entradas: number; saidas: number; movimentacoes: number }>("/api/estoque/metricas?periodo=mes");
  const alerts = alertsData?.alerts ?? [];
  return (
    <section>
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} description="Alertas, entradas e consumo do mês." />
      {error ? (
        <ErrorState title="Não foi possível carregar" description="Tente novamente." onRetry={() => window.location.reload()} />
      ) : !metrics ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" role="status" aria-label="Carregando"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Alertas" value={String(alerts.length)} hint="Críticos + pendências" />
            <StatCard label="Entradas (mês)" value={String(metrics.entradas)} hint="Quantidade" />
            <StatCard label="Saídas (mês)" value={String(metrics.saidas)} hint="Consumo" />
          </div>
          <Card title="Alertas ativos" className="mt-4" actions={<Link href="/estoque" className="text-sm font-semibold text-brand-700 hover:underline">Ver estoque</Link>}>
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum alerta. Estoque saudável.</p>
            ) : (
              <ul className="grid gap-2">
                {alerts.slice(0, 8).map((a, i) => (
                  <li key={i}>
                    <Link href={`/estoque/${a.product_id}`} className="text-sm hover:underline">
                      <Badge tone="warn">{a.type}</Badge> {a.product} <span className="text-slate-500">· {a.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function SolicitanteDashboard({ name }: { name: string }) {
  const { data, error } = useFetch<{ tickets: { id: string; number: number; kind: string; status: string }[] }>("/api/chamados?mine=1");
  const rows = data?.tickets ?? [];
  return (
    <section>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ""}`}
        description="Suas solicitações e documentos."
        actions={<Link href="/solicitar" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Nova solicitação</Link>}
      />
      {error ? (
        <ErrorState title="Não foi possível carregar" description="Tente novamente." onRetry={() => window.location.reload()} />
      ) : !data ? (
        <div role="status" aria-label="Carregando"><Skeleton className="h-24" /></div>
      ) : (
        <Card title="Minhas solicitações">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma solicitação com seu e-mail. Abra a primeira pelo botão acima.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="font-mono font-bold">#{t.number}</span>
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-slate-500">{t.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { me, loading } = useMe();
  const name = me?.displayName ?? me?.email?.split("@")[0] ?? "";
  if (loading) {
    return (
      <section>
        <PageHeader title="Painel" />
        <div role="status" aria-label="Carregando painel"><Skeleton className="h-24" /></div>
      </section>
    );
  }
  if (me?.role === "tecnico") return <TecnicoDashboard name={name} />;
  if (me?.role === "comprador") return <CompradorDashboard name={name} />;
  if (me?.role === "estoque") return <EstoqueDashboard name={name} />;
  if (me?.role === "solicitante") return <SolicitanteDashboard name={name} />;
  return <GestorDashboard name={name} />;
}
