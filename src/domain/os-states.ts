/** Maquina de estados da OS. RETOMADA e evento (D-15), nao status persistido. */

export const OS_STATUSES = [
  "ABERTA",
  "ATRIBUIDA",
  "EM_EXECUCAO",
  "PAUSADA",
  "CONCLUIDA",
  "VALIDACAO",
  "ENCERRADA",
] as const;
export type OsStatus = (typeof OS_STATUSES)[number];

const TRANSITIONS: Record<OsStatus, OsStatus[]> = {
  ABERTA: ["ATRIBUIDA", "ENCERRADA"],
  ATRIBUIDA: ["EM_EXECUCAO", "ABERTA", "ENCERRADA"],
  EM_EXECUCAO: ["PAUSADA", "CONCLUIDA"],
  PAUSADA: ["EM_EXECUCAO"],
  CONCLUIDA: ["VALIDACAO", "EM_EXECUCAO"],
  VALIDACAO: ["ENCERRADA", "EM_EXECUCAO"],
  ENCERRADA: [],
};

export function canTransitionOs(from: OsStatus, to: OsStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionOs(from: OsStatus, to: OsStatus): OsStatus {
  if (!canTransitionOs(from, to)) {
    throw new Error(`Transicao invalida de OS: ${from} -> ${to}`);
  }
  return to;
}
