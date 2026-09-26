/** Maquina de estados da compra — arvores TICKET e WORK_ORDER compartilham o ciclo. */

export const PURCHASE_STATUSES = [
  "SOLICITADA",
  "EM_ANALISE",
  "DESIGNADA",
  "COTACAO",
  "AGUARDANDO_APROVACAO",
  "APROVADA",
  "NEGOCIACAO",
  "PAGAMENTO",
  "EM_TRANSITO",
  "RECEBIDA",
  "CONCLUIDA",
  "REJEITADA",
  "CANCELADA",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

const TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  SOLICITADA: ["EM_ANALISE", "CANCELADA"],
  EM_ANALISE: ["DESIGNADA", "REJEITADA", "CANCELADA"],
  DESIGNADA: ["COTACAO", "CANCELADA"],
  COTACAO: ["AGUARDANDO_APROVACAO", "CANCELADA"],
  AGUARDANDO_APROVACAO: ["APROVADA", "REJEITADA", "CANCELADA"],
  APROVADA: ["NEGOCIACAO", "CANCELADA"],
  NEGOCIACAO: ["PAGAMENTO", "CANCELADA"],
  PAGAMENTO: ["EM_TRANSITO", "CANCELADA"],
  EM_TRANSITO: ["RECEBIDA"],
  RECEBIDA: ["CONCLUIDA"],
  CONCLUIDA: [],
  REJEITADA: ["SOLICITADA"],
  CANCELADA: [],
};

export function canTransitionPurchase(from: PurchaseStatus, to: PurchaseStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionPurchase(from: PurchaseStatus, to: PurchaseStatus): PurchaseStatus {
  if (!canTransitionPurchase(from, to)) {
    throw new Error(`Transicao invalida de compra: ${from} -> ${to}`);
  }
  return to;
}
