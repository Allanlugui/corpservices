/**
 * SLA deterministico da OS (D-05). Pausa congela: tempo parado nunca e consumido.
 * Tudo em ms, `now` injetavel para testes.
 */

export interface PauseInterval {
  pausedAt: number;
  resumedAt: number | null;
}

/** Tempo ativo (executado) entre start e now, descontando pausas. */
export function activeMs(start: number, pauses: PauseInterval[], now: number): number {
  let paused = 0;
  for (const p of pauses) {
    const end = p.resumedAt ?? now;
    if (end > p.pausedAt) paused += Math.min(end, now) - p.pausedAt;
  }
  return Math.max(0, now - start - paused);
}

/** Prazo restante = total - ativo. Nunca negativo. */
export function remainingMs(totalMs: number, start: number, pauses: PauseInterval[], now: number): number {
  return Math.max(0, totalMs - activeMs(start, pauses, now));
}

export function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
