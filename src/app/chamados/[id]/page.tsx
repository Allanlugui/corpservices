"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

interface Detail {
  ticket: {
    id: string;
    number: number;
    kind: string;
    status: string;
    requester_name: string;
    requester_email: string;
    category: string | null;
    priority: string | null;
    payload: Record<string, string>;
    ai_suggested_kind: string | null;
    ai_missing_fields: string[];
    created_at: string;
  };
  events: { event: string; from_status: string | null; to_status: string | null; detail: Record<string, unknown>; created_at: string }[];
}

const NEXT: Record<string, { label: string; to: string }[]> = {
  NOVO: [{ label: "Iniciar triagem", to: "EM_TRIAGEM" }],
  EM_TRIAGEM: [
    { label: "Enviar para análise", to: "EM_ANALISE" },
    { label: "Resolver direto", to: "RESOLVIDO" },
  ],
  EM_ANALISE: [{ label: "Resolver", to: "RESOLVIDO" }],
  RESOLVIDO: [
    { label: "Encerrar", to: "ENCERRADO" },
    { label: "Reabrir análise", to: "EM_ANALISE" },
  ],
  CONVERTIDO: [{ label: "Encerrar", to: "ENCERRADO" }],
  ENCERRADO: [],
};

export default function ChamadoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(`/api/chamados/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setDetail(json.data as Detail);
      })
      .catch(() => setError("Falha de rede."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) setError(json.error?.message ?? "Acao recusada.");
      else load();
    } catch {
      setError("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !detail) return <p role="alert" className="text-sm font-medium text-red-700">{error}</p>;
  if (!detail) return <p className="text-sm text-slate-600">Carregando…</p>;
  const { ticket, events } = detail;

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader
        title={`Chamado #${ticket.number}`}
        description={`${ticket.requester_name} · ${ticket.requester_email}`}
        actions={<Badge tone={ticket.status === "NOVO" ? "warn" : "pending"}>{ticket.status.replaceAll("_", " ")}</Badge>}
      />
      <div className="grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm"><strong>Tipo:</strong> {ticket.kind} · <strong>Sugestão IA:</strong> {ticket.ai_suggested_kind ?? "—"}</p>
          <ul className="mt-2 text-sm">
            {Object.entries(ticket.payload).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Ações do gestor</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(NEXT[ticket.status] ?? []).map((a) => (
              <button key={a.to} disabled={busy} onClick={() => void act({ action: "advance", to: a.to })} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {a.label}
              </button>
            ))}
            {(ticket.status === "EM_ANALISE" || ticket.status === "EM_TRIAGEM") && (
              <>
                <button disabled={busy} onClick={() => void act({ action: "convert", target: "os" })} className="rounded border border-slate-900 px-3 py-2 text-sm font-semibold disabled:opacity-50">
                  Converter em OS
                </button>
                <button disabled={busy} onClick={() => void act({ action: "convert", target: "compra" })} className="rounded border border-slate-900 px-3 py-2 text-sm font-semibold disabled:opacity-50">
                  Converter em compra
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">Conversão registra o destino; OS e compra nascem nas Fases 05/06.</p>
          {error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Histórico</h2>
          <ul className="mt-1 text-sm">
            {events.map((e, i) => (
              <li key={i}>{e.event}{e.from_status ? ` (${e.from_status} → ${e.to_status})` : ""} — {new Date(e.created_at).toLocaleString("pt-BR")}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
