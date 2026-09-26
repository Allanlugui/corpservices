"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";

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
    <section className="mx-auto max-w-xl">
      <PageHeader title="Acompanhar solicitação" />
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); setLoading(true); void lookup(token); }} className="flex gap-2">
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token do link" aria-label="Token de acompanhamento" className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
          <Button type="submit" disabled={loading}>
            {loading ? "…" : "Buscar"}
          </Button>
        </form>
      </Card>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      {info ? (
        <Card
          title={`Protocolo ${info.number}`}
          className="mt-4"
          actions={<StatusBadge status={info.status} />}
        >
          <p className="text-sm"><strong>Tipo:</strong> {info.kind}</p>
          {info.summary ? <p className="mt-1 text-sm text-slate-700">{info.summary}</p> : null}
          <h2 className="mt-4 font-semibold">Histórico</h2>
          <div className="mt-2">
            <Timeline
              items={events.length === 0 ? [{ title: "Recebido", detail: "Aguardando triagem.", at: info.created_at }] : events.map((e) => ({ title: e.event, at: e.at }))}
            />
          </div>
        </Card>
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
