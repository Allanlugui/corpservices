"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

interface Goal {
  id: string;
  name: string;
  metric: string;
  target: number;
  current: number;
}

const METRIC_LABEL: Record<string, string> = {
  chamados_resolvidos: "Chamados resolvidos",
  os_concluidas: "OS concluídas",
  compras_concluidas: "Compras concluídas",
  os_no_prazo: "OS no prazo",
};

export default function MetasPage() {
  const toast = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [periodo, setPeriodo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", metric: "chamados_resolvidos", target: "10" });

  useEffect(() => {
    fetch("/api/metas")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else {
          setGoals(json.data.goals as Goal[]);
          setPeriodo(json.data.periodo as string);
        }
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    fetch("/api/metas")
      .then(async (res) => {
        const json = await res.json();
        if (!json.error) {
          setGoals(json.data.goals as Goal[]);
          setPeriodo(json.data.periodo as string);
        }
      })
      .catch(() => {});
  }

  async function create() {
    if (form.name.trim().length < 2 || !(Number(form.target) > 0)) {
      toast("Informe nome e meta válida.", "error");
      return;
    }
    const res = await fetch("/api/metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), metric: form.metric, target: Number(form.target) }),
    });
    const json = await res.json();
    if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível criar.", "error");
    else {
      toast("Meta criada.");
      setForm({ name: "", metric: "chamados_resolvidos", target: "10" });
      void refresh();
    }
  }

  async function deactivate(id: string) {
    await fetch("/api/metas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: false }),
    });
    void refresh();
  }

  return (
    <section>
      <PageHeader title="Metas" description={`Acompanhamento do ${periodo || "período"}. Metas configuráveis, nunca fixas no código.`} />
      {loading ? (
        <LoadingState label="Carregando metas…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            return (
              <Card
                key={g.id}
                title={g.name}
                actions={<Button variant="ghost" size="sm" onClick={() => void deactivate(g.id)}>Desativar</Button>}
              >
                <p className="text-sm text-slate-600">{METRIC_LABEL[g.metric] ?? g.metric}</p>
                <p className="mt-1 text-2xl font-bold">{g.current}<span className="text-sm font-normal text-slate-500"> / {g.target}</span></p>
                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={g.name} className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-600" : "bg-slate-900"}`} style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
          <Card title="Nova meta (gestor)">
            <div className="grid gap-3">
              <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select label="Métrica" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Input label="Meta do mês" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} inputMode="numeric" />
              <Button variant="secondary" onClick={() => void create()}>Criar meta</Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
