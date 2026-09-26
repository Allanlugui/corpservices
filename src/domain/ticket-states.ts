/** Maquina de estados do Ticket — fonte unica (espelha migration v2). */

export const TICKET_STATUSES = [
  "NOVO",
  "EM_TRIAGEM",
  "EM_ANALISE",
  "CONVERTIDO",
  "RESOLVIDO",
  "ENCERRADO",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NOVO: ["EM_TRIAGEM"],
  EM_TRIAGEM: ["EM_ANALISE", "RESOLVIDO"],
  EM_ANALISE: ["CONVERTIDO", "RESOLVIDO"],
  CONVERTIDO: ["ENCERRADO"],
  RESOLVIDO: ["ENCERRADO", "EM_ANALISE"],
  ENCERRADO: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: TicketStatus, to: TicketStatus): TicketStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Transicao invalida de ticket: ${from} -> ${to}`);
  }
  return to;
}
