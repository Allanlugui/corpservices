"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { AuditoriaViewer } from "@/components/AuditoriaViewer";
import { LogsViewer } from "@/components/LogsViewer";

interface Health {
  status: string;
  version: string;
  time: string;
  integrations: { name: string; status: string; detail: string }[];
}

const TONE: Record<string, string> = {
  CONFIGURADO: "ok",
  NAO_CONFIGURADO: "blocked",
  PENDENTE_DE_INTEGRACAO: "pending",
  MOCK: "warn",
};

function Saude() {
  const [health, setHealth] = useState<Health | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    fetch("/api/health")
      .then(async (res) => {
        setHealth((await res.json()).data as Health);
        setLatency(Math.round(performance.now() - start));
      })
      .catch(() => {});
  }, []);

  if (!health) return <LoadingState label="Verificando sistema…" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card title="Aplicação">
        <p className="text-sm"><Badge tone="ok">{health.status.toUpperCase()}</Badge></p>
        <p className="mt-2 font-mono text-xs">versão {health.version}</p>
        <p className="font-mono text-xs">resposta em {latency ?? "?"} ms</p>
      </Card>
      {health.integrations.map((i) => (
        <Card key={i.name} title={i.name}>
          <Badge tone={TONE[i.status] ?? "pending"}>{i.status.replaceAll("_", " ")}</Badge>
          <p className="mt-2 text-sm text-slate-600">{i.detail}</p>
        </Card>
      ))}
    </div>
  );
}

function Backup() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function exportar(target: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/backup/export?target=${target}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setResult(`Erro: ${json.error?.message}`);
        return;
      }
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corpservices-backup-${target}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setResult(`Exportado: ${json.data.meta.tables} tabelas, ${json.data.meta.rows} linhas (${target}).`);
    } catch {
      setResult("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Backup e migração (D-21)">
      <p className="text-sm text-slate-600">
        Exporta dados + esquema + mapa de coleções para migração. Não é replicação ao vivo:
        a restauração exige os scripts de importação do banco destino.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["supabase", "mongodb", "mariadb"] as const).map((t) => (
          <Button key={t} variant="secondary" disabled={busy} onClick={() => void exportar(t)}>
            Exportar p/ {t === "supabase" ? "Supabase/Postgres" : t === "mongodb" ? "MongoDB" : "MariaDB/MySQL"}
          </Button>
        ))}
      </div>
      {result ? <p className="mt-2 text-sm">{result}</p> : null}
    </Card>
  );
}

function Parametros() {
  const toast = useToast();
  const [settings, setSettings] = useState<{ key: string; label: string; type: string; min: number; max: number; default: number; consumer: string; value: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/configuracoes")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setSettings(json.data.settings);
      })
      .catch(() => setError("Falha de rede."));
  }, []);

  async function save(key: string, value: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível salvar.", "error");
      else toast("Parâmetro salvo (com auditoria).");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState title="Parâmetros indisponíveis" description={error} onRetry={() => window.location.reload()} />;
  return (
    <div className="grid gap-3">
      {settings.map((s) => (
        <Card key={s.key} title={s.label}>
          <p className="text-xs text-slate-500">Usado em: {s.consumer} · padrão {s.default} · faixa {s.min}–{s.max}</p>
          <div className="mt-2 flex items-end gap-2">
            <div className="w-32">
              <Input label="Valor" type="number" min={s.min} max={s.max} defaultValue={s.value} id={`param-${s.key}`} />
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const el = document.getElementById(`param-${s.key}`) as HTMLInputElement | null;
                const v = Number(el?.value);
                if (!Number.isFinite(v)) {
                  toast("Valor inválido.", "error");
                  return;
                }
                void save(s.key, v);
              }}
            >
              Salvar
            </Button>
          </div>
        </Card>
      ))}
      {settings.length === 0 ? <LoadingState label="Carregando parâmetros…" /> : null}
    </div>
  );
}

function ConfigInner({ initialTab }: { initialTab: number }) {
  return (
    <section>
      <PageHeader title="Configurações" description="Auditoria, logs, saúde, backup e parâmetros." />
      <Tabs
        initial={initialTab}
        tabs={[
          { id: "auditoria", label: "Auditoria", content: <AuditoriaViewer /> },
          { id: "logs", label: "Logs", content: <LogsViewer /> },
          { id: "saude", label: "Saúde", content: <Saude /> },
          { id: "backup", label: "Backup", content: <Backup /> },
          {
            id: "parametros",
            label: "Parâmetros",
            content: <Parametros />,
          },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/" className="font-semibold text-brand-700 hover:underline">← Voltar ao Dashboard</Link>
      </p>
    </section>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <ConfigWithParams />
    </Suspense>
  );
}

function ConfigWithParams() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const initial = tab === "logs" ? 1 : tab === "saude" ? 2 : tab === "backup" ? 3 : tab === "parametros" ? 4 : 0;
  return <ConfigInner key={initial} initialTab={initial} />;
}
