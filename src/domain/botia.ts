/**
 * BotIA — camada de abstracao (D-07). A IA RECOMENDA; humanos DECIDEM.
 * DeterministicProvider: regras sem rede; unico provider ate um LLM ser configurado.
 * Proibido a qualquer provider: aprovar/rejeitar compra, encerrar OS, mutar estoque.
 */

export type TicketKind = "servico" | "compra";

export interface TriageInput {
  kind: TicketKind;
  fields: Record<string, string>;
}

export interface TriageResult {
  suggestedKind: TicketKind;
  missingFields: string[];
  summary: string;
}

const COMPRA_FIELDS = ["item", "quantidade", "prazo", "criticidade", "justificativa"] as const;
const SERVICO_FIELDS = ["descricao", "local", "prioridade"] as const;

const COMPRA_HINTS = ["comprar", "compra", "aquisicao", "fornecedor", "cotacao", "material", "peca", "equipamento novo"];
const SERVICO_HINTS = ["quebrou", "defeito", "manutencao", "reparo", "vazamento", "nao liga", "barulho", "instalacao", "pintura", "limpeza"];

export interface AIProvider {
  readonly name: string;
  triage(input: TriageInput): Promise<TriageResult>;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function score(text: string, hints: string[]): number {
  const t = norm(text);
  return hints.filter((h) => t.includes(norm(h))).length;
}

export class DeterministicProvider implements AIProvider {
  readonly name = "deterministic-v1";

  async triage(input: TriageInput): Promise<TriageResult> {
    const freeText = Object.values(input.fields).join(" ");
    const compraScore = score(freeText, COMPRA_HINTS);
    const servicoScore = score(freeText, SERVICO_HINTS);
    // Em empate, respeita a escolha do solicitante (nunca sobrescreve humano).
    const suggestedKind: TicketKind =
      compraScore === servicoScore
        ? input.kind
        : compraScore > servicoScore
          ? "compra"
          : "servico";
    const required = suggestedKind === "compra" ? COMPRA_FIELDS : SERVICO_FIELDS;
    const missingFields = required.filter((f) => !(input.fields[f] ?? "").trim());
    const summary =
      suggestedKind === "compra"
        ? `Compra: ${input.fields["item"] ?? "(item nao informado)"} x${input.fields["quantidade"] ?? "?"}`
        : (input.fields["descricao"] ?? "").slice(0, 140);
    return { suggestedKind, missingFields, summary };
  }
}
