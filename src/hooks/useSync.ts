"use client";

import { useCallback, useEffect, useState } from "react";
import { dequeue, loadQueue, markAttempt, saveQueue, type OutboxOp, type SyncResult } from "@/lib/outbox";
import { deletePhotoBlob, getPhotoBlob } from "@/lib/photo-queue";
import { useOnline } from "./useOnline";

async function sendOp(op: OutboxOp): Promise<SyncResult> {
  try {
    // Fase 19: foto capturada offline — blob sai do IndexedDB para o upload.
    if (op.type === "file.upload") {
      const p = op.payload as { ownerType: string; ownerId: string; folder: string; blobKey: string; name: string; mime: string };
      let blob: Blob | null = null;
      try {
        blob = await getPhotoBlob(p.blobKey);
      } catch {
        return { status: "retry", message: "Armazenamento local indisponível" };
      }
      if (!blob) return { status: "rejected", message: "Foto local não encontrada (limpeza do navegador?)" };
      const file = new File([blob], p.name || "foto.jpg", { type: p.mime || blob.type || "image/jpeg" });
      const form = new FormData();
      form.append("file", file);
      form.append("owner_type", p.ownerType);
      form.append("owner_id", p.ownerId);
      form.append("folder", p.folder);
      const res = await fetch("/api/arquivos", { method: "POST", body: form });
      if (res.ok) {
        await deletePhotoBlob(p.blobKey).catch(() => {});
        return { status: "applied" };
      }
      if (res.status >= 400 && res.status < 500) {
        const json = await res.json().catch(() => null);
        await deletePhotoBlob(p.blobKey).catch(() => {});
        return { status: "rejected", message: json?.error?.message ?? `HTTP ${res.status}` };
      }
      return { status: "retry", message: `HTTP ${res.status}` };
    }
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

/** Fila offline + sincronização bidirecional v1 (push outbox + pull detecção). */
export function useSync() {
  const online = useOnline();
  const [queue, setQueue] = useState<OutboxOp[]>(() => loadQueue());
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [rejected, setRejected] = useState(0);

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
    setRejected((prev) => prev + rejected);
    // Fase 20 pull: o que mudou no servidor desde o último sync.
    try {
      const since = localStorage.getItem("corpservices.sync.last") ?? new Date(0).toISOString();
      const res = await fetch(`/api/sync/pull?since=${encodeURIComponent(since)}`);
      if (res.ok) {
        const json = await res.json();
        setRemoteTotal(Number(json.data?.total ?? 0));
        if (json.data?.server_now) localStorage.setItem("corpservices.sync.last", json.data.server_now as string);
      }
    } catch {
      /* pull é informativo; push já foi */
    }
  }, [persist]);

  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => void sync(), 0);
    return () => clearTimeout(t);
  }, [online, sync]);

  return { online, queue, pending: queue.length, syncing, lastResult, sync, persist, remoteTotal, rejected };
}
