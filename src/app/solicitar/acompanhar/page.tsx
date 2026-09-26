"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

interface TicketInfo {
  number: number;
  kind: string;
  status: string;
  category: string | null;
  priority: string | null;
  summary: string;
  created_at: string;
}

function Acompanhar() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [events, setEvents] = useState<{ event: string; at: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => searchParams.get("token") !== null);

  async function lookup(t: string) {
    if (!t) return;
    setError(null);
    try {
      const res = await fetch(`/api/tickets/acompanhar?token=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError("Solicitação não encontrada. Confira o link.");
        setInfo(null);
        return;
      }
      setInfo(json.data.ticket as TicketInfo);
      setEvents(json.data.events as { event: string; at: string }[]);
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) return;
    fetch(`/api/tickets/acompanhar?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          setError("Solicitação não encontrada. Confira o link.");
          setInfo(null);
        } else {
          setInfo(json.data.ticket as TicketInfo);
          setEvents(json.data.events as { event: string; at: string }[]);
        }
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-lg">
      <PageHeader title="Acompanhar solicitação" />
      <form onSubmit={(e) => { e.preventDefault(); setLoading(true); void lookup(token); }} className="flex gap-2">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token do link" className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono text-sm" />
        <button type="submit" disabled={loading} className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "…" : "Buscar"}
        </button>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      {info ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">Protocolo {info.number}</p>
            <Badge tone={info.status === "NOVO" ? "pending" : "ok"}>{info.status.replaceAll("_", " ")}</Badge>
          </div>
          <p className="mt-2 text-sm"><strong>Tipo:</strong> {info.kind}</p>
          {info.summary ? <p className="mt-1 text-sm text-slate-700">{info.summary}</p> : null}
          <h2 className="mt-4 font-semibold">Histórico</h2>
          <ul className="mt-1 text-sm">
            {events.length === 0 ? <li className="text-slate-500">Recebido, aguardando triagem.</li> : null}
            {events.map((e, i) => <li key={i}>{e.event} — {new Date(e.at).toLocaleString("pt-BR")}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function AcompanharPage() {
  return (
    <Suspense>
      <Acompanhar />
    </Suspense>
  );
}
