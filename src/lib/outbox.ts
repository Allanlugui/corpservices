/**
 * Outbox offline (Fase 09 v1). Operações locais com chave idempotente (UUID);
 * o servidor devolve o registro existente em vez de duplicar.
 * Estratégia de conflito: servidor vence (operações críticas) e transições
 * inválidas no replay são descartadas como rejeitadas, nunca aplicadas à força.
 */

export type OpType = "ticket.create" | "ticket.transition" | "os.transition" | "file.upload";

export interface OutboxOp {
  key: string;
  type: OpType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

export type SyncResult =
  | { status: "applied" }
  | { status: "rejected"; message: string }
  | { status: "retry"; message: string };

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function enqueue(queue: OutboxOp[], op: Omit<OutboxOp, "key" | "createdAt" | "attempts"> & { key?: string }): OutboxOp[] {
  const full: OutboxOp = {
    key: op.key ?? newKey(),
    createdAt: Date.now(),
    attempts: 0,
    ...op,
  } as OutboxOp;
  if (queue.some((q) => q.key === full.key)) return queue;
  return [...queue, full].sort((a, b) => a.createdAt - b.createdAt);
}

export function dequeue(queue: OutboxOp[], key: string): OutboxOp[] {
  return queue.filter((q) => q.key !== key);
}

export function markAttempt(queue: OutboxOp[], key: string): OutboxOp[] {
  return queue.map((q) => (q.key === key ? { ...q, attempts: q.attempts + 1 } : q));
}

const STORE_KEY = "corpservices.outbox.v1";

export function loadQueue(getItem: (k: string) => string | null = (k) =>
  typeof localStorage === "undefined" ? null : localStorage.getItem(k),
): OutboxOp[] {
  try {
    const raw = getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((o) => o && o.key && o.type) : [];
  } catch {
    return [];
  }
}

export function saveQueue(
  queue: OutboxOp[],
  setItem: (k: string, v: string) => void = (k, v) => localStorage.setItem(k, v),
): void {
  try {
    setItem(STORE_KEY, JSON.stringify(queue));
  } catch {
    // Armazenamento cheio/bloqueado: a fila vive só em memória nesta sessão.
  }
}
