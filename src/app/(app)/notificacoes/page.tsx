"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export default function NotificacoesPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/notificacoes")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.notifications as Notification[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/notificacoes")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setRows(json.data.notifications as Notification[]);
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, []);

  async function markAll() {
    await fetch("/api/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  async function markOne(id: string) {
    await fetch("/api/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function checkAlerts() {
    const res = await fetch("/api/notify/check", { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      alert(json?.error?.message ?? "Sem permissão (gestor/admin).");
      return;
    }
    load();
  }

  return (
    <section>
      <PageHeader
        title="Notificações"
        description="Eventos importantes da operação."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void checkAlerts()}>Verificar alertas (SLA/estoque)</Button>
            {rows.some((n) => !n.read_at) ? <Button variant="secondary" size="sm" onClick={() => void markAll()}>Marcar todas como lidas</Button> : null}
          </>
        }
      />
      {loading ? (
        <LoadingState label="Carregando notificações…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : rows.length === 0 ? (
        <Card title="Tudo em dia"><p className="text-sm text-slate-500">Nenhuma notificação.</p></Card>
      ) : (
        <ul className="grid gap-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={!n.read_at ? "border-l-4 border-l-brand-600" : undefined}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}
                    </p>
                    {n.body ? <p className="text-sm text-slate-600">{n.body}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  {!n.read_at ? (
                    <>
                      <Badge tone="info">NOVA</Badge>
                      <Button variant="ghost" size="sm" onClick={() => void markOne(n.id)}>Marcar lida</Button>
                    </>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
