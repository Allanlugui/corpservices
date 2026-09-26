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
  kpis: { novos: number; em_atendimento: number; resolvidos: number; convertidos: number };
  recent: { id: string; number: number; kind: string; status: string; requester_name: string; created_at: string }[];
  activity: { event: string; created_at: string }[];
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
            <StatCard label="Resolvidos" value={String(data.kpis.resolvidos)} hint="Aguardando encerramento" />
            <StatCard label="Convertidos" value={String(data.kpis.convertidos)} hint="Rumo a OS/compra" />
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
            <Card title="Ordens de Serviço">
              <p className="text-sm text-slate-500">O ciclo de OS chega na Fase 05. Chamados convertidos aguardam aqui.</p>
            </Card>
            <Card title="Compras">
              <p className="text-sm text-slate-500">Solicitações, cotações e aprovações chegam na Fase 06.</p>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
