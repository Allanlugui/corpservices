"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

type Kind = "servico" | "compra";

const SERVICO_STEPS = [
  { key: "descricao", label: "Descreva o problema", type: "textarea", required: true },
  { key: "local", label: "Onde? (local/setor)", type: "text", required: true },
  { key: "prioridade", label: "Prioridade", type: "select", options: ["baixa", "media", "alta", "critica"], required: true },
  { key: "equipamento", label: "Equipamento/ativo (se houver)", type: "text", required: false },
] as const;

const COMPRA_STEPS = [
  { key: "item", label: "O que precisa comprar?", type: "text", required: true },
  { key: "quantidade", label: "Quantidade", type: "text", required: true },
  { key: "prazo", label: "Prazo desejado", type: "text", required: true },
  { key: "criticidade", label: "Criticidade", type: "select", options: ["baixa", "media", "alta", "critica"], required: true },
  { key: "justificativa", label: "Justificativa", type: "textarea", required: true },
] as const;

interface Created {
  number: number;
  tracking_token: string;
  tracking_url: string;
  suggested_kind: Kind;
  missing_fields: string[];
}

export default function SolicitarPage() {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const fieldSteps = kind === "servico" ? SERVICO_STEPS : COMPRA_STEPS;
  // step 0 = tipo, 1 = identificacao, 2..n+1 = campos, ultimo = revisao
  const totalSteps = 2 + fieldSteps.length + 1;

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 0) return kind !== null;
    if (step === 1) return name.trim().length >= 2 && /.+@.+\..+/.test(email);
    if (step < 2 + fieldSteps.length) {
      const field = fieldSteps[step - 2];
      if (!field.required) return true;
      return (fields[field.key] ?? "").trim().length > 0;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!kind) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, requester_name: name, requester_email: email, fields }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message ?? "Falha ao enviar. Tente novamente.");
        return;
      }
      setCreated(json.data as Created);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (created) {
    return (
      <section className="mx-auto max-w-lg">
        <PageHeader title="Solicitação registrada" actions={<Badge tone="ok">PROTOCOLO {created.number}</Badge>} />
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Guarde este link para acompanhar:</p>
          <a href={created.tracking_url} className="mt-1 block break-all font-mono text-sm font-semibold text-slate-900 underline">
            {created.tracking_url}
          </a>
          {created.missing_fields.length > 0 ? (
            <p className="mt-3 text-sm text-amber-800">
              Nossa triagem sugeriu completar: {created.missing_fields.join(", ")}. Um atendente pode pedir esses dados.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Envio do link por e-mail: PENDENTE (sem provedor SMTP configurado). Por enquanto, salve o link acima.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg">
      <PageHeader title="Nova solicitação" description={`Etapa ${Math.min(step + 1, totalSteps)} de ${totalSteps}`} />
      <form
        onSubmit={step === totalSteps - 1 ? submit : (e) => { e.preventDefault(); if (canAdvance()) setStep(step + 1); }}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        {step === 0 && (
          <div className="grid gap-3">
            {(["servico", "compra"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { setKind(k); setFields({}); }}
                className={`rounded-lg border px-4 py-3 text-left font-semibold ${kind === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
              >
                {k === "servico" ? "Serviço / manutenção" : "Compra de material"}
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4">
            <label className="block text-sm font-medium">Nome completo
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium">E-mail corporativo
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
            </label>
          </div>
        )}
        {step >= 2 && step < 2 + fieldSteps.length && (() => {
          const field = fieldSteps[step - 2];
          return (
            <label className="block text-sm font-medium">{field.label}
              {field.type === "textarea" ? (
                <textarea value={fields[field.key] ?? ""} onChange={(e) => setField(field.key, e.target.value)} required={field.required} rows={4} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
              ) : field.type === "select" ? (
                <select value={fields[field.key] ?? ""} onChange={(e) => setField(field.key, e.target.value)} required={field.required} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2">
                  <option value="">Selecione…</option>
                  {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={fields[field.key] ?? ""} onChange={(e) => setField(field.key, e.target.value)} required={field.required} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
              )}
            </label>
          );
        })()}
        {step === totalSteps - 1 && (
          <div className="text-sm">
            <p><strong>Tipo:</strong> {kind}</p>
            <p><strong>Nome:</strong> {name} · <strong>E-mail:</strong> {email}</p>
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(fields).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Fotos e documentos: disponiveis a partir da FASE 08 (explorador de arquivos).</p>
          </div>
        )}
        {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded border border-slate-300 px-4 py-2 font-semibold">Voltar</button>}
          <button type="submit" disabled={!canAdvance() || sending} className="flex-1 rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
            {sending ? "Enviando…" : step === totalSteps - 1 ? "Confirmar e enviar" : "Continuar"}
          </button>
        </div>
      </form>
    </section>
  );
}
