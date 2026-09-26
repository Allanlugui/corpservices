import { describe, expect, it } from "vitest";
import { canTransitionOs, transitionOs } from "./os-states";
import { activeMs, remainingMs } from "./sla";

const DAY = 86_400_000;

describe("os-states", () => {
  it("ciclo feliz: ABERTA ate ENCERRADA", () => {
    expect(transitionOs("ABERTA", "ATRIBUIDA")).toBe("ATRIBUIDA");
    expect(transitionOs("ATRIBUIDA", "EM_EXECUCAO")).toBe("EM_EXECUCAO");
    expect(transitionOs("EM_EXECUCAO", "CONCLUIDA")).toBe("CONCLUIDA");
    expect(transitionOs("CONCLUIDA", "VALIDACAO")).toBe("VALIDACAO");
    expect(transitionOs("VALIDACAO", "ENCERRADA")).toBe("ENCERRADA");
  });

  it("pausa e retomada via evento (PAUSADA -> EM_EXECUCAO)", () => {
    expect(canTransitionOs("EM_EXECUCAO", "PAUSADA")).toBe(true);
    expect(canTransitionOs("PAUSADA", "EM_EXECUCAO")).toBe(true);
    expect(canTransitionOs("PAUSADA", "CONCLUIDA")).toBe(false);
  });

  it("rejeita atalhos e saidas do terminal", () => {
    expect(() => transitionOs("ABERTA", "CONCLUIDA")).toThrow();
    expect(canTransitionOs("ENCERRADA", "EM_EXECUCAO")).toBe(false);
  });
});

describe("sla", () => {
  const start = 0;
  const total = 10 * DAY;

  it("sem pausa consome integral", () => {
    expect(activeMs(start, [], 4 * DAY)).toBe(4 * DAY);
    expect(remainingMs(total, start, [], 4 * DAY)).toBe(6 * DAY);
  });

  it("pausa congela: restante antes == restante depois", () => {
    const before = remainingMs(total, start, [], 4 * DAY);
    const pauses = [{ pausedAt: 4 * DAY, resumedAt: 9 * DAY }];
    const after = remainingMs(total, start, pauses, 9 * DAY);
    expect(before).toBe(6 * DAY);
    expect(after).toBe(6 * DAY);
  });

  it("pausa aberta usa now injetado", () => {
    const pauses = [{ pausedAt: 4 * DAY, resumedAt: null }];
    expect(remainingMs(total, start, pauses, 6 * DAY)).toBe(6 * DAY);
  });

  it("multiplas pausas somam", () => {
    const pauses = [
      { pausedAt: 1 * DAY, resumedAt: 2 * DAY },
      { pausedAt: 4 * DAY, resumedAt: 6 * DAY },
    ];
    expect(activeMs(start, pauses, 7 * DAY)).toBe(4 * DAY);
    expect(remainingMs(total, start, pauses, 7 * DAY)).toBe(6 * DAY);
  });

  it("nunca negativo", () => {
    expect(remainingMs(total, start, [], 20 * DAY)).toBe(0);
  });
});
