import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { getIntegrations } from "@/lib/integrations";

const toneFor = (status: string) =>
  status === "CONFIGURADO" ? "ok" : status === "NAO_CONFIGURADO" ? "blocked" : "pending";

export default function Home() {
  const integrations = getIntegrations();
  return (
    <section>
      <PageHeader
        title="Painel operacional"
        description="Visão factual do estado da plataforma. Nenhum número aqui é mockado: enquanto os módulos não existirem, o painel mostra o estado da fundação."
        actions={<Badge tone="pending">FASE 03 · TICKETS</Badge>}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Fase atual" value="03 — Tickets" hint="Portal público no ar" />
        <StatCard label="Módulos funcionais" value="1 de 8" hint="Solicitar; demais PENDENTES" />
        <StatCard label="Integrações ativas" value="1 de 5" hint="Supabase; ver /api/health" />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Integrações</h2>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {integrations.map((item) => (
          <li key={item.name} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-slate-600">{item.detail}</p>
            </div>
            <Badge tone={toneFor(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
