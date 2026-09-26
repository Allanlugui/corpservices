"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "todos" | "servico" | "compra";

interface Ticket {
  id: string;
  number: number;
  kind: string;
  status: string;
  priority: string | null;
  requester_name: string;
  created_at: string;
}

const toneFor = (status: string) =>
  status === "NOVO" ? "warn" : status === "ENCERRADO" || status === "RESOLVIDO" ? "ok" : "pending";

export default function ChamadosPage() {
  const [tab, setTab] = useState<Tab>("todos");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = tab === "todos" ? "" : `?kind=${tab}`;
    fetch(`/api/chamados${qs}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setTickets(json.data.tickets as Ticket[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, [tab]);

  function switchTab(t: Tab) {
    setTab(t);
    setTickets([]);
    setError(null);
    setLoading(true);
  }

  return (
    <section>
      <PageHeader title="Chamados" description="Triagem e acompanhamento dos tickets." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtrar por tipo">
        {(["todos", "servico", "compra"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-300"}`}
          >
            {t === "todos" ? "Todos" : t === "servico" ? "Serviços" : "Compras"}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-slate-600">Carregando…</p>
      ) : error ? (
        <p role="alert" className="text-sm font-medium text-red-700">{error}</p>
      ) : tickets.length === 0 ? (
        <EmptyState title="Nenhum chamado" description="Novos tickets do portal aparecem aqui." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/chamados/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <span className="font-mono font-bold">#{t.number}</span>
                <Badge tone={toneFor(t.status)}>{t.status.replaceAll("_", " ")}</Badge>
                <span className="text-sm font-medium">{t.requester_name}</span>
                <span className="text-xs text-slate-500">{t.kind} · {new Date(t.created_at).toLocaleString("pt-BR")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
