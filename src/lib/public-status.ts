/**
 * Rótulos públicos do acompanhamento (portal do solicitante).
 * Puro e testável. Nunca expõe atores, valores ou detalhes internos —
 * só status e marcos. Vale para ticket, OS e compra convertida.
 */

const TICKET: Record<string, string> = {
  NOVO: "Recebida",
  EM_TRIAGEM: "Em triagem",
  EM_ANALISE: "Em análise",
  CONVERTIDO: "Encaminhada para execução",
  CONCLUIDO: "Concluída",
  CANCELADO: "Cancelada",
};

const OS: Record<string, string> = {
  ABERTA: "Ordem aberta",
  ATRIBUIDA: "Técnico designado",
  EM_EXECUCAO: "Em execução",
  PAUSADA: "Pausada temporariamente",
  CONCLUIDA: "Execução concluída",
  VALIDACAO: "Em validação final",
  ENCERRADA: "Encerrada",
};

const COMPRA: Record<string, string> = {
  SOLICITADA: "Solicitação registrada",
  EM_ANALISE: "Em análise",
  DESIGNADA: "Responsável designado",
  COTACAO: "Em cotação",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADA: "Aprovada",
  NEGOCIACAO: "Em negociação",
  PAGAMENTO: "Em pagamento",
  EM_TRANSITO: "A caminho",
  RECEBIDA: "Recebida",
  CONCLUIDA: "Concluída",
  REJEITADA: "Não aprovada",
  CANCELADA: "Cancelada",
};

const EVENTOS: Record<string, string> = {
  CRIADO: "Recebida",
  ALTERADO: "Atualizada",
  DEPARTAMENTO: "Classificado no setor",
  CONVERTIDO: "Encaminhada para execução",
  DESIGNADO: "Responsável designado",
  INICIADO: "Execução iniciada",
  PAUSADO: "Pausada temporariamente",
  RETOMADO: "Execução retomada",
  CONCLUIDO: "Execução concluída",
  VALIDADO: "Validada",
  ENCERRADO: "Encerrada",
  COTACAO_ADICIONADA: "Cotação recebida",
  APROVADA: "Aprovada",
  REJEITADA: "Não aprovada",
  PEDIDO_ATUALIZADO: "Pedido atualizado",
  COMPONENTE_RECEBIDO: "Material recebido",
  RECEBIDA: "Recebida",
  COMPRA_REJEITADA: "Não aprovada",
};

function pretty(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function labelTicketStatus(status: string): string {
  return TICKET[status] ?? pretty(status);
}

export function labelOsStatus(status: string): string {
  return OS[status] ?? pretty(status);
}

export function labelCompraStatus(status: string): string {
  return COMPRA[status] ?? pretty(status);
}

export function labelEvento(event: string): string {
  return EVENTOS[event] ?? pretty(event);
}
