"use client";

import { Suspense, useEffect, useState, type ChangeEvent } from "react";
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
import { Locais } from "@/components/Locais";
import RelatoriosPage from "../relatorios/page";

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

function Email() {
  const toast = useToast();
  const [queue, setQueue] = useState<{ counts: Record<string, number>; provider: string; configured: boolean } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/notify/process");
    if (res.ok) setQueue((await res.json()).data);
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/notify/process").then(async (res) => {
      if (res.ok && alive) setQueue((await res.json()).data);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function processQueue() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha no processamento.", "error");
      else {
        toast(`Enviados: ${json.data.sent} · falhas: ${json.data.failed}`);
        void reload();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo.includes("@")) {
      toast("Informe um e-mail válido.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/notify/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test_email: testTo }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha no teste.", "error");
      else toast("E-mail de teste enviado.");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!queue) return <LoadingState label="Carregando fila de e-mail…" />;
  return (
    <div className="grid gap-3">
      <Card title="Provedor">
        <p className="text-sm"><Badge tone={queue.configured ? "ok" : "blocked"}>{queue.configured ? `RESEND ATIVO` : "NÃO CONFIGURADO"}</Badge></p>
        <p className="mt-2 text-sm text-slate-600">
          {queue.configured
            ? "Chave RESEND_API_KEY presente no servidor. Fila processada pelo botão abaixo ou agendador externo."
            : "Defina RESEND_API_KEY no ambiente (Vercel) e EMAIL_FROM. Sem chave, a fila acumula e nada é enviado."}
        </p>
      </Card>
      <Card title="Fila">
        <p className="text-sm">Pendentes: <strong>{queue.counts.PENDING ?? 0}</strong> · Enviados: {queue.counts.SENT ?? 0} · Falhas: {queue.counts.FAILED ?? 0} · Sem e-mail: {queue.counts.SKIPPED ?? 0}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy || !queue.configured} onClick={() => void processQueue()}>Processar fila agora</Button>
        </div>
      </Card>
      <Card title="Teste">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <Input label="Enviar teste para" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="voce@empresa.com" inputMode="email" />
          </div>
          <Button variant="secondary" disabled={busy || !queue.configured} onClick={() => void sendTest()}>Enviar teste</Button>
        </div>
      </Card>
      <p className="text-xs text-slate-500">Kill-switch por org em Parâmetros → E-mail ativo. Push configurado abaixo.</p>
      <WhatsCard />
      <SignatureCard />
      <PushCard />
    </div>
  );
}

function urlBase64ToU8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function WhatsCard() {
  const toast = useToast();
  const [queue, setQueue] = useState<{ counts: Record<string, number>; configured: boolean; template: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/notify/whatsapp").then(async (res) => {
      if (res.ok && alive) setQueue((await res.json()).data);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function savePhone() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Telefone inválido.", "error");
      else toast("WhatsApp ativado para seus avisos.");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function processQueue() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast(`Enviados: ${json.data.sent} · falhas: ${json.data.failed}`);
        const r = await fetch("/api/notify/whatsapp");
        if (r.ok) setQueue((await r.json()).data);
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test_phone: testTo }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha no teste.", "error");
      else toast("Template de teste enviado.");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!queue) return <LoadingState label="Carregando WhatsApp…" />;
  return (
    <Card title="WhatsApp">
      <p className="text-sm"><Badge tone={queue.configured ? "ok" : "blocked"}>{queue.configured ? "META API ATIVA" : "NÃO CONFIGURADO"}</Badge></p>
      <p className="mt-2 text-sm text-slate-600">
        {queue.configured
          ? `Template "${queue.template}". Cadastre seu número para receber avisos de compra.`
          : "Defina WHATSAPP_TOKEN + WHATSAPP_PHONE_ID no ambiente. Sem isso, a fila acumula e nada é enviado."}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Input label="Meu WhatsApp (DDD+número)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void savePhone()}>Salvar número</Button>
      </div>
      <p className="mt-2 text-sm">Fila — pendentes: <strong>{queue.counts.PENDING ?? 0}</strong> · enviados: {queue.counts.SENT ?? 0} · falhas: {queue.counts.FAILED ?? 0}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Button variant="secondary" disabled={busy || !queue.configured} onClick={() => void processQueue()}>Processar fila</Button>
        <div className="w-52">
          <Input label="Teste para" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
        </div>
        <Button variant="secondary" disabled={busy || !queue.configured} onClick={() => void sendTest()}>Enviar teste</Button>
      </div>
    </Card>
  );
}

function SignatureCard() {
  const toast = useToast();
  const [form, setForm] = useState({ display_name: "", job_title: "", phone: "", body_text: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/notify/signature").then(async (res) => {
      if (!res.ok || !alive) return;
      const s = (await res.json()).data.signature;
      if (s && alive) {
        setForm({ display_name: s.display_name ?? "", job_title: s.job_title ?? "", phone: s.phone ?? "", body_text: s.body_text ?? "" });
        setImageUrl(s.image_url ?? null);
      }
      if (alive) setLoaded(true);
    }).catch(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/notify/signature", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível salvar.", "error");
      else toast("Assinatura salva.");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_048_576) {
      toast("Use PNG, JPG ou WEBP de até 1 MB.", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/notify/signature", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha no envio.", "error");
      else {
        setImageUrl(json.data.image_url);
        toast("Imagem da assinatura atualizada.");
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <LoadingState label="Carregando assinatura…" />;
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Card title="Minha assinatura (operador)">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={form.display_name} onChange={set("display_name")} placeholder="Seu nome" />
        <Input label="Cargo" value={form.job_title} onChange={set("job_title")} placeholder="Ex: Comprador" />
        <Input label="Telefone" value={form.phone} onChange={set("phone")} placeholder="Ex: (11) 99999-9999" />
        <label className="block text-sm font-medium">Imagem (logo)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
          />
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium">Texto da assinatura
        <textarea value={form.body_text} onChange={set("body_text")} rows={2} placeholder="Ex: CorpServices Group — Suprimentos" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {(form.display_name || imageUrl) ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-2 text-xs text-slate-500">Prévia como sai no e-mail:</p>
          {imageUrl ? <img src={imageUrl} alt="Assinatura" width={160} style={{ maxWidth: 160, height: "auto" }} /> : null}
          {form.display_name ? <p><strong>{form.display_name}</strong>{form.job_title ? ` — ${form.job_title}` : ""}</p> : null}
          {form.phone ? <p>{form.phone}</p> : null}
          {form.body_text ? <p>{form.body_text}</p> : null}
        </div>
      ) : null}
      <Button variant="secondary" disabled={busy} onClick={() => void save()} className="mt-3">Salvar assinatura</Button>
    </Card>
  );
}

function PushCard() {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "on" | "off" | "unsupported">("idle");
  const [busy, setBusy] = useState(false);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    let alive = true;
    const done = (s: "on" | "off" | "unsupported") => {
      if (alive) setState(s);
    };
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapid) {
      done("unsupported");
      return () => {
        alive = false;
      };
    }
    void navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      done(sub ? "on" : "off");
    }).catch(() => done("unsupported"));
    return () => {
      alive = false;
    };
  }, [vapid]);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToU8(vapid) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        toast("Não foi possível ativar.", "error");
      } else {
        setState("on");
        toast("Push ativado neste dispositivo.");
      }
    } catch {
      toast("Permissão negada ou falha.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      toast("Push desativado.");
    } catch {
      toast("Falha ao desativar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/subscribe", { method: "PUT" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else toast(`Push enviado (${json.data.sent} dispositivo(s)).`);
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Push neste dispositivo">
      {state === "unsupported" ? (
        <p className="text-sm text-slate-500">Push indisponível (navegador sem suporte ou VAPID ausente).</p>
      ) : state === "idle" ? (
        <LoadingState label="Verificando push…" />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Badge tone={state === "on" ? "ok" : "blocked"}>{state === "on" ? "ATIVO" : "INATIVO"}</Badge>
          {state === "on" ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => void test()}>Enviar teste</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void disable()}>Desativar</Button>
            </>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => void enable()}>Ativar push</Button>
          )}
        </div>
      )}
    </Card>
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
          { id: "email", label: "E-mail e push", content: <Email /> },
          { id: "locais", label: "Locais", content: <Locais /> },
          { id: "relatorios", label: "Relatórios", content: <RelatoriosPage /> },
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
  const initial = tab === "logs" ? 1 : tab === "saude" ? 2 : tab === "backup" ? 3 : tab === "parametros" ? 4 : tab === "email" ? 5 : tab === "locais" ? 6 : tab === "relatorios" ? 7 : 0;
  return <ConfigInner key={initial} initialTab={initial} />;
}
