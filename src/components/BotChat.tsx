"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BOT_COMMON, BOT_COMPRA, BOT_SERVICO, isValidEmail, matchLocation, type BotField, type BotKind } from "@/lib/bot-flow";

interface Msg {
  from: "bot" | "user";
  text: string;
  options?: string[];
}

interface Collected {
  kind: BotKind | null;
  name: string;
  email: string;
  locationId: string;
  locationDetail: string;
  fields: Record<string, string>;
}

async function interpret(task: "kind" | "level" | "confirm", text: string): Promise<string | boolean | null> {
  try {
    const res = await fetch("/api/bot/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, text }),
    });
    if (!res.ok) return null;
    const v = (await res.json()).data.value as string | boolean | null;
    return v;
  } catch {
    return null;
  }
}

const CONFIRM_LABEL: Record<string, string> = {
  __nome: "nome",
  __email: "e-mail",
  __local: "local",
};

/** Assistente conversacional do portal: conduz, interpreta e preenche. */
export function BotChat({ locations, onDone }: { locations: { id: string; path: string }[]; onDone: (c: { number: number; tracking_url: string; missing_fields: string[] }) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [collected, setCollected] = useState<Collected>({ kind: null, name: "", email: "", locationId: "", locationDetail: "", fields: {} });
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Quando o LLM declara ready, a próxima resposta confirma o envio.
  const pendingConfirm = useRef<Collected | null>(null);

  const steps: (BotField | { key: "__kind" } | { key: "__confirm" })[] = collected.kind
    ? [...BOT_COMMON, ...(collected.kind === "servico" ? BOT_SERVICO : BOT_COMPRA), { key: "__confirm" }]
    : [{ key: "__kind" }];

  const push = (m: Msg) => setMsgs((prev) => [...prev, m]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) push({ from: "bot", text: "Olá! Sou o assistente. Descreva com suas palavras o que você precisa — manutenção ou compra?" });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  function questionFor(step: (typeof steps)[number]): { text: string; options?: string[] } {
    if (step.key === "__kind") return { text: "É manutenção/serviço ou compra de material?", options: ["Manutenção / serviço", "Compra de material"] };
    if (step.key === "__confirm") return { text: "Confere tudo? Posso enviar?", options: ["Sim, enviar", "Não, voltar ao formulário"] };
    const f = step as BotField;
    if (f.key === "__local") {
      const roots = locations.filter((l) => !l.path.includes("›")).slice(0, 6).map((l) => l.path);
      return {
        text: locations.length > 0 ? "Onde você está? Pode dizer com suas palavras (ex: segundo andar lado A) ou escolher." : f.label,
        options: ["Pular", ...roots],
      };
    }
    return { text: f.label, options: f.type === "select" ? f.options : undefined };
  }

  async function submit(col: Collected) {
    setBusy(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: col.kind,
          requester_name: col.name,
          requester_email: col.email,
          fields: col.fields,
          location_id: col.locationId || null,
          location_detail: col.locationDetail,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        const det = json.error?.details ? ` (${Object.keys(json.error.details).join(", ")})` : "";
        setError(`${json.error?.message ?? "Falha ao enviar."}${det}`);
        push({ from: "bot", text: "Não consegui enviar. Tente de novo ou use o formulário." });
        return;
      }
      setDone(true);
      onDone(json.data);
    } catch {
      setError("Sem conexão.");
      push({ from: "bot", text: "Sem conexão agora. Tente de novo em instantes." });
    } finally {
      setBusy(false);
    }
  }

  async function answer(raw: string) {
    const text = raw.trim();
    if (!text || busy || done) return;
    push({ from: "user", text });
    setInput("");
    setBusy(true);
    setError(null);
    // Confirmação pendente do modo LLM: sim envia, resto volta a conversar.
    if (pendingConfirm.current) {
      const col = pendingConfirm.current;
      pendingConfirm.current = null;
      if (/^(sim|s|isso|correto|confirmo|pode enviar|ok)\b/i.test(text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))) {
        push({ from: "bot", text: "Enviando…" });
        await submit(col);
        setBusy(false);
        return;
      }
      push({ from: "bot", text: "Certo, me diga o que ajustar." });
      setBusy(false);
      return;
    }
    try {
      // Bot real: LLM com contexto; roteiro local se indisponível.
      const history = [...msgs, { from: "user" as const, text }].slice(-12);
      let usedLlm = false;
      try {
        const res = await fetch("/api/bot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, collected, locations: locations.slice(0, 30) }),
        });
        const json = await res.json();
        if (res.ok && json.data && json.data.fallback === false) {
          usedLlm = true;
          const col: Collected = {
            kind: (json.data.set?.kind as BotKind) ?? collected.kind,
            name: (json.data.set?.name as string) ?? collected.name,
            email: (json.data.set?.email as string) ?? collected.email,
            locationId: (json.data.set?.locationId as string) ?? collected.locationId,
            locationDetail: (json.data.set?.locationDetail as string) ?? collected.locationDetail,
            fields: { ...collected.fields, ...((json.data.set?.fields ?? {}) as Record<string, string>) },
          };
          // Local resolve locationId a partir do nome, caso o LLM mande texto.
          if (!col.locationId && col.locationDetail) {
            const hit = locations.find((l) => l.path.toLowerCase().includes(col.locationDetail.toLowerCase()));
            if (hit) {
              col.locationId = hit.id;
              col.locationDetail = "";
            }
          }
          setCollected(col);
          push({ from: "bot", text: json.data.reply as string, options: json.data.options as string[] | undefined });
          if (json.data.ready === true) {
            setStepIdx(Number.MAX_SAFE_INTEGER);
            pendingConfirm.current = col;
          }
          return;
        }
      } catch {
        /* cai no roteiro local */
      }
      if (!usedLlm) {
        await localAnswer(text);
      }
    } finally {
      setBusy(false);
    }
  }
  // Roteiro local (fallback quando o LLM indisponível): perguntas fixas.
  async function localAnswer(text: string) {
    try {
      const step = steps[stepIdx];
      const col = { ...collected, fields: { ...collected.fields } };

      if (step.key === "__kind") {
        let kind: BotKind | null = null;
        if (/manuten|serviço|servico/i.test(text) && !/compra/i.test(text)) kind = "servico";
        else if (/compra/i.test(text) && !/manuten|serviço|servico/i.test(text)) kind = "compra";
        else kind = (await interpret("kind", text)) as BotKind | null;
        if (!kind) {
          push({ from: "bot", text: "Não entendi — é manutenção/serviço ou compra?", options: ["Manutenção / serviço", "Compra de material"] });
          return;
        }
        col.kind = kind;
        setCollected(col);
        // A lista de etapas muda de forma ([__kind] → [__nome, __email, ...]);
        // recomeça do índice 0 para não pular o nome (off-by-one que prendia no e-mail).
        setStepIdx(0);
        push({ from: "bot", text: kind === "servico" ? "Entendido, manutenção. " + BOT_COMMON[0].label : "Entendido, compra. " + BOT_COMMON[0].label });
        return;
      }

      if (step.key === "__confirm") {
        const c = /sim|enviar/i.test(text) && !/não|nao/i.test(text) ? true : /não|nao/i.test(text) ? false : await interpret("confirm", text);
        if (c === true) {
          push({ from: "bot", text: "Enviando…" });
          setCollected(col);
          await submit(col);
          return;
        }
        push({ from: "bot", text: "Sem problema. Use o formulário para ajustar — seus dados já vão preenchidos." });
        return;
      }

      const f = step as BotField;
      if (f.key === "__nome") {
        if (text.length < 2) {
          push({ from: "bot", text: "Pode me dizer seu nome completo?" });
          return;
        }
        col.name = text;
      } else if (f.key === "__email") {
        if (!isValidEmail(text)) {
          // Dúvida em vez de e-mail: explica em vez de repetir o erro.
          if (/\?|como|por ?qu[eê]|nao entendi|n[aã]o sei/i.test(text)) {
            push({ from: "bot", text: "Preciso do seu e-mail corporativo para enviar o protocolo. É o e-mail da empresa, ex: voce@empresa.com." });
          } else {
            push({ from: "bot", text: "Esse e-mail parece inválido. Confere? Ex: voce@empresa.com." });
          }
          return;
        }
        col.email = text.trim();
      } else if (f.key === "__local") {
        if (!/^pular$/i.test(text)) {
          const exact = locations.find((l) => l.path.toLowerCase() === text.toLowerCase());
          if (exact) {
            col.locationId = exact.id;
          } else {
            const matches = matchLocation(text, locations);
            if (matches.length === 1) {
              col.locationId = matches[0].id;
              push({ from: "bot", text: `Entendi: ${matches[0].path}.` });
            } else if (matches.length > 1) {
              push({ from: "bot", text: "Encontrei estes — qual deles?", options: matches.map((m) => m.path) });
              return;
            } else {
              col.locationDetail = text;
            }
          }
        }
      } else if (f.type === "select" && f.options) {
        const direct = f.options.find((o) => o.toLowerCase() === text.toLowerCase());
        if (direct) {
          col.fields[f.key] = direct;
        } else {
          const v = (await interpret("level", text)) as string | null;
          if (!v) {
            push({ from: "bot", text: `Não captei a urgência. Escolha uma opção:`, options: f.options });
            return;
          }
          col.fields[f.key] = v;
        }
      } else {
        if (f.required && text.length < 2) {
          push({ from: "bot", text: "Me conta um pouco mais?" });
          return;
        }
        col.fields[f.key] = text;
      }
      setCollected(col);
      const next = stepIdx + 1;
      setStepIdx(next);
      const nq = questionFor(steps[next]);
      if (steps[next].key === "__confirm") {
        const resumo = [
          `Tipo: ${col.kind === "servico" ? "manutenção" : "compra"}`,
          `Nome: ${col.name}`,
          ...Object.entries(col.fields).map(([k, v]) => `${CONFIRM_LABEL[k] ?? k}: ${v}`),
        ].join(" · ");
        push({ from: "bot", text: `Resumo: ${resumo}. ${nq.text}`, options: nq.options });
      } else {
        push({ from: "bot", text: nq.text, options: nq.options });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Assistente">
      <div aria-live="polite" className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
              <p>{m.text}</p>
              {m.options && !done ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.options.map((o) => (
                    <button key={o} type="button" disabled={busy} onClick={() => void answer(o)} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                      {o}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? <p className="text-xs text-slate-400">digitando…</p> : null}
        <div ref={bottomRef} />
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
      {!done ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void answer(input);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva aqui…"
            aria-label="Mensagem"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy || !input.trim()}>Enviar</Button>
        </form>
      ) : null}
    </Card>
  );
}
