"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { Button } from "@/components/ui/button";
import { Input, Select, Checkbox } from "@/components/ui/fields";
import { ConfirmDialog } from "@/components/ui/modal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatRemaining } from "@/domain/sla";

interface Wo {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  location: string | null;
  assigned_to: string | null;
  sla_total_ms: number;
  sla_remaining_ms: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}
interface Pause {
  id: string;
  reason: string;
  paused_at: string;
  resumed_at: string | null;
  duration_ms: number | null;
  sla_before_ms: number;
  sla_after_ms: number | null;
}
interface CheckItem {
  id: string;
  label: string;
  done: boolean;
}
interface Material {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
}

interface Detail {
  work_order: Wo;
  pauses: Pause[];
  checklist: CheckItem[];
  materials: Material[];
  events: { event: string; from_status: string | null; to_status: string | null; created_at: string }[];
}

const ACTIONS: Record<string, { label: string; action: string; extra?: Record<string, string> }[]> = {
  ABERTA: [{ label: "Atribuir a mim", action: "assign-self" }],
  ATRIBUIDA: [{ label: "Iniciar execução", action: "start" }],
  EM_EXECUCAO: [
    { label: "Pausar", action: "pause" },
    { label: "Concluir", action: "complete" },
  ],
  PAUSADA: [{ label: "Retomar", action: "resume" }],
  CONCLUIDA: [
    { label: "Enviar para validação", action: "validate" },
    { label: "Reabrir execução", action: "reopen" },
  ],
  VALIDACAO: [
    { label: "Encerrar", action: "close" },
    { label: "Devolver à execução", action: "reopen" },
  ],
  ENCERRADA: [],
};

function DetailInner({ id }: { id: string }) {
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pauseReason, setPauseReason] = useState("aguardando autorizacao");
  const [reasons, setReasons] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ label: string; body: Record<string, unknown> } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newMat, setNewMat] = useState({ product_name: "", quantity: "1", unit: "un" });

  function load() {
    fetch(`/api/os/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setDetail(json.data as Detail);
      })
      .catch(() => setError("Falha de rede."));
  }

  useEffect(() => {
    load();
    fetch("/api/os/pause-reasons")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && !json.error) setReasons(json.data.reasons as string[]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/os/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Ação recusada.", "error");
      else {
        toast(`OS atualizada: ${label}.`);
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function runAction(kind: string) {
    if (kind === "assign-self") {
      const me = await fetch("/api/me").then((r) => r.json());
      const userId = me?.data?.userId as string | undefined;
      if (!userId) {
        toast("Não foi possível identificar o usuário.", "error");
        return;
      }
      setConfirm({ label: "Atribuir a mim", body: { action: "assign", assigned_to: userId } });
      return;
    }
    if (kind === "pause") {
      setConfirm({ label: "Pausar OS", body: { action: "pause", reason: pauseReason } });
      return;
    }
    const map: Record<string, Record<string, unknown>> = {
      start: { action: "start" },
      resume: { action: "resume" },
      complete: { action: "complete" },
      validate: { action: "validate" },
      reopen: { action: "reopen" },
      close: { action: "close" },
    };
    const labels: Record<string, string> = {
      start: "Iniciar execução", resume: "Retomar", complete: "Concluir",
      validate: "Validar", reopen: "Reabrir", close: "Encerrar",
    };
    setConfirm({ label: labels[kind] ?? kind, body: map[kind] ?? { action: kind } });
  }

  async function addChecklist() {
    if (!newItem.trim()) return;
    const res = await fetch(`/api/os/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newItem.trim() }),
    });
    if (res.ok) {
      setNewItem("");
      load();
    } else toast("Não foi possível adicionar.", "error");
  }

  async function toggleCheck(item: CheckItem) {
    const res = await fetch(`/api/os/${id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, done: !item.done }),
    });
    if (res.ok) load();
    else toast("Não foi possível atualizar.", "error");
  }

  async function addMaterial() {
    if (!newMat.product_name.trim()) return;
    const res = await fetch(`/api/os/${id}/items?kind=material`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: newMat.product_name.trim(), quantity: Number(newMat.quantity) || 1, unit: newMat.unit || "un" }),
    });
    if (res.ok) {
      setNewMat({ product_name: "", quantity: "1", unit: "un" });
      load();
    } else toast("Não foi possível adicionar.", "error");
  }

  if (error && !detail) return <ErrorState title="OS indisponível" description={error} onRetry={() => window.location.reload()} />;
  if (!detail) return <LoadingState label="Carregando OS…" />;
  const { work_order: wo, pauses, checklist, materials, events } = detail;
  const openPause = pauses.find((p) => !p.resumed_at);

  return (
    <section>
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Ordens de Serviço", href: "/os" }, { label: `OS-${String(wo.number).padStart(6, "0")}` }]} />
      <div className="mt-2">
        <PageHeader
          title={`OS-${String(wo.number).padStart(6, "0")} · ${wo.title}`}
          description={`${wo.location ?? "Local não informado"} · SLA restante ${formatRemaining(wo.sla_remaining_ms)}${openPause ? " (congelado — pausada)" : ""}`}
          actions={<><StatusBadge status={wo.status} /> <PriorityBadge priority={wo.priority} /></>}
        />
      </div>
      <Tabs
        tabs={[
          {
            id: "resumo",
            label: "Resumo",
            content: (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Detalhes" className="lg:col-span-2">
                  <p className="whitespace-pre-wrap text-sm">{wo.description || "Sem descrição."}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-500">Iniciada em</dt><dd className="font-medium">{wo.started_at ? new Date(wo.started_at).toLocaleString("pt-BR") : "—"}</dd></div>
                    <div><dt className="text-slate-500">Concluída em</dt><dd className="font-medium">{wo.finished_at ? new Date(wo.finished_at).toLocaleString("pt-BR") : "—"}</dd></div>
                  </dl>
                </Card>
                <Card title="Ações">
                  <div className="grid gap-2">
                    {(ACTIONS[wo.status] ?? []).map((a) => (
                      <Button key={a.action} disabled={busy} onClick={() => void runAction(a.action)}>
                        {a.label}
                      </Button>
                    ))}
                    {wo.status === "EM_EXECUCAO" && (
                      <Select label="Motivo da pausa" value={pauseReason} onChange={(e) => setPauseReason(e.target.value)}>
                        {(reasons.length > 0 ? reasons : ["aguardando autorizacao", "falta de componente", "outros"]).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </Select>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: "execucao",
            label: `Execução (${checklist.filter((c) => c.done).length}/${checklist.length})`,
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Checklist">
                  <div className="grid gap-2">
                    {checklist.map((c) => (
                      <Checkbox key={c.id} label={c.label} checked={c.done} onChange={() => void toggleCheck(c)} />
                    ))}
                    {checklist.length === 0 ? <p className="text-sm text-slate-500">Nenhum item. Adicione o primeiro passo.</p> : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input label="Novo item" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                    <Button variant="secondary" onClick={() => void addChecklist()} className="mt-auto">Adicionar</Button>
                  </div>
                </Card>
                <Card title="Materiais">
                  <ul className="grid gap-1 text-sm">
                    {materials.map((m) => <li key={m.id}>{m.quantity} {m.unit} × {m.product_name}</li>)}
                    {materials.length === 0 ? <li className="text-slate-500">Nenhum material consumido.</li> : null}
                  </ul>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="col-span-3"><Input label="Material" value={newMat.product_name} onChange={(e) => setNewMat({ ...newMat, product_name: e.target.value })} /></div>
                    <Input label="Qtd" value={newMat.quantity} onChange={(e) => setNewMat({ ...newMat, quantity: e.target.value })} />
                    <Input label="Un" value={newMat.unit} onChange={(e) => setNewMat({ ...newMat, unit: e.target.value })} />
                    <Button variant="secondary" onClick={() => void addMaterial()} className="mt-auto">Adicionar</Button>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: "pausas",
            label: `Pausas (${pauses.length})`,
            content: (
              <Card title="Pausas e SLA">
                {pauses.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma pausa registrada.</p>
                ) : (
                  <ul className="grid gap-3 text-sm">
                    {pauses.map((p) => (
                      <li key={p.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="font-semibold">{p.reason} {p.resumed_at ? "" : "(aberta — SLA congelado)"}</p>
                        <p className="text-slate-600">Pausa: {new Date(p.paused_at).toLocaleString("pt-BR")}
                          {p.resumed_at ? ` → retomada ${new Date(p.resumed_at).toLocaleString("pt-BR")} (${formatRemaining(p.duration_ms ?? 0)} parada)` : ""}</p>
                        <p className="font-mono text-xs">SLA antes {formatRemaining(p.sla_before_ms)}{p.sla_after_ms !== null ? ` → depois ${formatRemaining(p.sla_after_ms)}` : ""}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
          {
            id: "historico",
            label: `Histórico (${events.length})`,
            content: (
              <Card title="Linha do tempo">
                <Timeline items={events.map((e) => ({ title: `${e.event}${e.from_status ? ` (${e.from_status} → ${e.to_status})` : ""}`, at: e.created_at }))} />
              </Card>
            ),
          },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/os" className="font-semibold text-brand-700 hover:underline">← Voltar para Ordens de Serviço</Link>
      </p>
      {confirm ? (
        <ConfirmDialog
          title={confirm.label}
          description={`Confirmar "${confirm.label}"? O evento fica registrado no histórico da OS.`}
          confirmLabel={confirm.label}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => void act(confirm.body, confirm.label)}
        />
      ) : null}
    </section>
  );
}

export default function OSDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <DetailInner id={id} />
    </Suspense>
  );
}
