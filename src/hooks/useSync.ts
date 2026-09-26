"use client";

import { useCallback, useEffect, useState } from "react";
import { dequeue, loadQueue, markAttempt, saveQueue, type OutboxOp, type SyncResult } from "@/lib/outbox";
import { useOnline } from "./useOnline";

async function sendOp(op: OutboxOp): Promise<SyncResult> {
  try {
    if (op.type === "ticket.create") {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(op.payload as Record<string, unknown>), client_key: op.key }),
      });
      if (res.ok) return { status: "applied" };
      if (res.status >= 400 && res.status < 500) {
        const json = await res.json().catch(() => null);
        return { status: "rejected", message: json?.error?.message ?? `HTTP ${res.status}` };
      }
      return { status: "retry", message: `HTTP ${res.status}` };
    }
    if (op.type === "ticket.transition") {
      const { id, ...body } = op.payload as { id: string } & Record<string, unknown>;
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, client_key: op.key }),
      });
      if (res.ok) return { status: "applied" };
      if (res.status === 422) {
        const json = await res.json().catch(() => null);
        return { status: "rejected", message: json?.error?.message ?? "Transição inválida no servidor" };
      }
      if (res.status === 401 || res.status === 403) {
        const json = await res.json().catch(() => null);
        return { status: "rejected", message: json?.error?.message ?? "Sem permissão" };
      }
      return { status: "retry", message: `HTTP ${res.status}` };
    }
    const { id, ...body } = op.payload as { id: string } & Record<string, unknown>;
    const res = await fetch(`/api/os/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, client_key: op.key }),
    });
    if (res.ok) return { status: "applied" };
    if (res.status === 422 || res.status === 401 || res.status === 403) {
      const json = await res.json().catch(() => null);
      return { status: "rejected", message: json?.error?.message ?? "Rejeitada pelo servidor" };
    }
    return { status: "retry", message: `HTTP ${res.status}` };
  } catch {
    return { status: "retry", message: "Sem conexão" };
  }
}

/** Fila offline + sincronização. Servidor vence conflitos; replay é idempotente. */
export function useSync() {
  const online = useOnline();
  const [queue, setQueue] = useState<OutboxOp[]>(() => loadQueue());
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const persist = useCallback((q: OutboxOp[]) => {
    setQueue(q);
    saveQueue(q);
  }, []);

  const sync = useCallback(async () => {
    let current = loadQueue();
    if (current.length === 0) return;
    setSyncing(true);
    setLastResult(null);
    let applied = 0;
    let rejected = 0;
    for (const op of current) {
      const result = await sendOp(op);
      if (result.status === "applied" || result.status === "rejected") {
        if (result.status === "applied") applied += 1;
        else rejected += 1;
        current = dequeue(current, op.key);
        persist(current);
      } else {
        current = markAttempt(current, op.key);
        persist(current);
        break;
      }
    }
    setSyncing(false);
    setLastResult(`Sincronizadas ${applied}, rejeitadas ${rejected}, restantes ${current.length}.`);
  }, [persist]);

  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => void sync(), 0);
    return () => clearTimeout(t);
  }, [online, sync]);

  return { online, queue, pending: queue.length, syncing, lastResult, sync, persist };
}
