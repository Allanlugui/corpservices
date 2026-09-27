"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { labelCompraStatus, labelEvento, labelOsStatus, labelTicketStatus } from "@/lib/public-status";

interface TicketInfo {
  number: number;
  kind: string;
  status: string;
  category: string | null;
  priority: string | null;
  summary: string;
  created_at: string;
}

interface Marco {
  event: string;
  at: string;
}

interface Destino {
  number: number;
  status: string;
  events: Marco[];
}

const STEPS = ["Recebida", "Em análise", "Em execução", "Concluída"] as const;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Etapa atual 0–3 a partir do ticket + destinos. -1 = não prosseguiu. */
function currentStep(status: string, os: Destino | null, compra: Destino | null): number {
  if (status === "CANCELADO" || compra?.status === "REJEITADA" || compra?.status === "CANCELADA") return -1;
  if (os?.status === "ENCERRADA" || compra?.status === "CONCLUIDA" || status === "CONCLUIDO") return 3;
  if (status === "CONVERTIDO" || os || compra) return 2;
  if (status === "EM_ANALISE" || status === "EM_TRIAGEM") return 1;
  return 0;
}

function Stepper({ step }: { step: number }) {
  if (step < 0) {
    return (
      <div className="rounded-xl bg-slate-100 p-4 text-center">
        <p className="font-semibold text-slate-700">Esta solicitação não prosseguiu</p>
        <p className="mt-1 text-sm text-slate-500">Fale com o responsável pelo setor para detalhes.</p>
      </div>
    );
  }
  return (
    <ol aria-label="Progresso" className="grid grid-cols-4 gap-1">
      {STEPS.map((label, i) => {
        const done = i < step;
        const now = i === step;
        return (
          <li key={label} className="flex flex-col items-center text-center">
            <span
              aria-current={now ? "step" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                done ? "bg-emerald-600 text-white" : now ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`mt-1 text-[11px] leading-tight ${now ? "font-bold text-brand-900" : done ? "text-slate-700" : "text-slate-400"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DestinoCard({ tipo, destino }: { tipo: "os" | "compra"; destino: Destino }) {
  const isOs = tipo === "os";
  const statusLabel = isOs ? labelOsStatus(destino.status) : labelCompraStatus(destino.status);
  const finished = destino.status === "ENCERRADA" || destino.status === "CONCLUIDA";
  return (
    <Card
      title={isOs ? `Ordem de serviço ${destino.number}` : `Compra ${destino.number}`}
      actions={
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${finished ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-900"}`}>
          {statusLabel}
        </span>
      }
      className="mt-4"
    >
      <p className="text-sm text-slate-600">
        {isOs
          ? "Sua solicitação virou uma ordem de serviço e a equipe está cuidando dela."
          : "Sua solicitação virou um processo de compra e está sendo providenciada."}{" "}
        Tudo continua atualizando aqui, sem precisar de login.
      </p>
      {destino.events.length > 0 ? (
        <ul className="mt-3 space-y-0">
          {destino.events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {i < destino.events.length - 1 ? <span aria-hidden className="absolute left-[7px] top-5 h-full w-0.5 bg-slate-200" /> : null}
              <span aria-hidden className={`mt-1 h-[9px] w-[15px] shrink-0 rounded-full ${i === destino.events.length - 1 ? "bg-brand-700" : "bg-slate-300"}`} />
              <div>
                <p className="text-sm font-semibold">{labelEvento(e.event)}</p>
                <p className="text-xs text-slate-500">{fmtDate(e.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Em preparação — os marcos aparecem aqui.</p>
      )}
    </Card>
  );
}

function Acompanhar() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [events, setEvents] = useState<Marco[]>([]);
  const [destinoOs, setDestinoOs] = useState<Destino | null>(null);
  const [destinoCompra, setDestinoCompra] = useState<Destino | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(t: string) {
    const clean = t.trim();
    if (!clean) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/acompanhar?token=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok || json.error || json.data?.found === false) {
        setError("Não encontramos essa solicitação. Confira o link recebido.");
        setInfo(null);
        return;
      }
      setInfo(json.data.ticket as TicketInfo);
      setEvents((json.data.events ?? []) as Marco[]);
      setDestinoOs((json.data.destino_os ?? null) as Destino | null);
      setDestinoCompra((json.data.destino_compra ?? null) as Destino | null);
    } catch {
      setError("Sem conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void lookup(t);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useMemo(
    () => (info ? currentStep(info.status, destinoOs, destinoCompra) : 0),
    [info, destinoOs, destinoCompra],
  );

  return (
    <section className="mx-auto max-w-xl px-4 pb-10">
      <div className="pt-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">CorpServices</p>
        <h1 className="mt-1 text-2xl font-bold">Acompanhar solicitação</h1>
        <p className="mt-1 text-sm text-slate-500">Cole seu protocolo. Sem login, sem complicação.</p>
      </div>

      <Card className="mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(token);
          }}
          className="flex gap-2"
        >
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole o código do link"
            aria-label="Código de acompanhamento"
            inputMode="text"
            autoComplete="off"
            className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 font-mono text-sm"
          />
          <Button type="submit" disabled={loading} className="min-h-12 px-5">
            {loading ? "…" : "Buscar"}
          </Button>
        </form>
      </Card>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {info ? (
        <>
          <Card
            title={`Protocolo ${info.number}`}
            className="mt-4 border-2 border-brand-100"
            actions={
              <span className="rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white">
                {labelTicketStatus(info.status)}
              </span>
            }
          >
            <p className="text-sm text-slate-500">
              {info.kind === "compra" ? "Pedido de compra" : "Pedido de serviço"} · aberto em {fmtDate(info.created_at)}
            </p>
            {info.summary ? <p className="mt-2 font-medium">{info.summary}</p> : null}
            <div className="mt-4">
              <Stepper step={step} />
            </div>
          </Card>

          {destinoOs ? <DestinoCard tipo="os" destino={destinoOs} /> : null}
          {destinoCompra ? <DestinoCard tipo="compra" destino={destinoCompra} /> : null}

          <Card title="Histórico do pedido" className="mt-4">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">Recebido — aguardando triagem.</p>
            ) : (
              <ul className="space-y-0">
                {events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < events.length - 1 ? <span aria-hidden className="absolute left-[7px] top-5 h-full w-0.5 bg-slate-200" /> : null}
                    <span aria-hidden className="mt-1 h-[9px] w-[15px] shrink-0 rounded-full bg-slate-300" />
                    <div>
                      <p className="text-sm font-semibold">{labelEvento(e.event)}</p>
                      <p className="text-xs text-slate-500">{fmtDate(e.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      <p className="mt-6 text-center text-sm">
        <Link href="/solicitar" className="font-semibold text-brand-700 hover:underline">
          ← Fazer nova solicitação
        </Link>
      </p>
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
