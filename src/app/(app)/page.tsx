"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Timeline } from "@/components/ui/timeline";
import { useMe } from "@/hooks/useMe";

interface DashboardData {
  kpis: { novos: number; em_atendimento: number; resolvidos: number; convertidos: number; os_abertas: number; compras_pendentes: number };
  recent: { id: string; number: number; kind: string; status: string; requester_name: string; created_at: string }[];
  activity: { event: string; created_at: string }[];
  work_orders: { id: string; number: number; title: string; status: string }[];
  purchases: { id: string; number: number; status: string }[];
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { me } = useMe();
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

  const name = me?.displayName ?? me?.email?.split("@")[0] ?? "";

  return (
    <section>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ""}`}
        description="Operação de hoje: chamados, SLA e atividade recente."
      />
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
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card
              title="Chamados recentes"
              className="xl:col-span-2"
              actions={<Link href="/chamados" className="text-sm font-semibold text-brand-700 hover:underline">Ver todos</Link>}
            >
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
