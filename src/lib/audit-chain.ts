/** D-09: cadeia de auditoria. Puro e testável (sem server-only). */
import { createHash } from "node:crypto";

export interface ChainRow {
  id: string;
  org_id: string | null;
  event: string;
  detail: unknown;
  created_at: string;
  previous_hash: string | null;
  hash: string | null;
  hash_version: number;
}

/** JSON canônico: chaves ordenadas (mesma entrada → mesmo hash). */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Hash v2: conteúdo completo encadeado. */
export function chainHashV2(prev: string, orgId: string | null, event: string, detail: unknown, createdAt: string): string {
  return sha256(`${prev}|${orgId ?? ""}|${event}|${stableJson(detail)}|${createdAt}`);
}

/** Hash v1 (backfill legado): só o elo pelo id. */
export function chainHashV1(prev: string, id: string): string {
  return sha256(`${prev}|${id}`);
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  break_at: string | null;
}

/** Verifica elos (todas) + conteúdo (v2). Ordem: created_at, id. */
export function verifyChain(rows: ChainRow[]): VerifyResult {
  const sorted = [...rows].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
  );
  let prev = "";
  for (const r of sorted) {
    if ((r.previous_hash ?? "") !== prev) return { ok: false, checked: sorted.length, break_at: r.id };
    const expected =
      r.hash_version === 1 ? chainHashV1(prev, r.id) : chainHashV2(prev, r.org_id, r.event, r.detail, r.created_at);
    if (r.hash !== expected) return { ok: false, checked: sorted.length, break_at: r.id };
    prev = r.hash ?? "";
  }
  return { ok: true, checked: sorted.length, break_at: null };
}
