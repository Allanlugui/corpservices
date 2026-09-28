/**
 * Bot conversacional do portal (B5). Fluxo determinístico; o LLM só
 * INTERPRETA respostas livres (sinônimos, intenção). Sem LLM ou com
 * falha: regras locais assumem — nunca trava o solicitante.
 * Puro e testável.
 */

export type BotKind = "servico" | "compra";

export interface BotField {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  required: boolean;
}

export const BOT_COMMON: BotField[] = [
  { key: "__nome", label: "Qual seu nome completo?", type: "text", required: true },
  { key: "__email", label: "Seu e-mail corporativo?", type: "text", required: true },
  { key: "__local", label: "Onde você está? (escolha ou diga o local)", type: "select", required: false },
];

export const BOT_SERVICO: BotField[] = [
  { key: "descricao", label: "Descreva o problema com suas palavras.", type: "text", required: true },
  { key: "prioridade", label: "Qual a urgência?", type: "select", options: ["baixa", "media", "alta", "critica"], required: true },
  { key: "equipamento", label: "É algum equipamento? Qual? (pode pular)", type: "text", required: false },
];

export const BOT_COMPRA: BotField[] = [
  { key: "item", label: "O que precisa comprar?", type: "text", required: true },
  { key: "quantidade", label: "Qual a quantidade?", type: "text", required: true },
  { key: "prazo", label: "Para quando precisa?", type: "text", required: true },
  { key: "criticidade", label: "Qual a criticidade?", type: "select", options: ["baixa", "media", "alta", "critica"], required: true },
  { key: "justificativa", label: "Por que precisa? (justificativa)", type: "text", required: true },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Intenção de tipo a partir de texto livre (fallback local do Gemini). */
export function detectKind(text: string): BotKind | null {
  const t = norm(text);
  const compra = ["comprar", "compra", "aquisicao", "fornecedor", "cotacao", "material", "peca", "pedido de compra"].filter((h) => t.includes(norm(h))).length;
  const servico = ["quebrou", "defeito", "manutencao", "reparo", "vazamento", "nao liga", "barulho", "instalacao", "pintura", "limpeza", "ar condicionado", "conserto"].filter((h) => t.includes(norm(h))).length;
  if (compra === 0 && servico === 0) return null;
  if (compra === servico) return null;
  return compra > servico ? "compra" : "servico";
}

/** Nível de urgência a partir de sinônimos (fallback local). */
export function detectLevel(text: string): string | null {
  const t = norm(text);
  if (/(critic|urgente|parado|emergencia|agora|imediat)/.test(t)) return "critica";
  if (/(alta|rapido|importante|prioridade alta)/.test(t)) return "alta";
  if (/(media|medio|normal|quando der)/.test(t)) return "media";
  if (/(baixa|sem pressa|rotina|quando possivel)/.test(t)) return "baixa";
  if (/\b(critica|alta|media|baixa)\b/.test(t)) {
    return (t.match(/\b(critica|alta|media|baixa)\b/) as RegExpMatchArray)[1];
  }
  return null;
}

/** Sim/não (fallback local). */
export function detectConfirm(text: string): boolean | null {
  const t = norm(text).trim();
  if (/^(sim|s|isso|correto|confirmo|pode enviar|ok|certo)\b/.test(t)) return true;
  if (/^(nao|n|errado|cancela|volta)\b/.test(t)) return false;
  return null;
}

export function isValidEmail(text: string): boolean {
  return /.+@.+\..+/.test(text.trim());
}

const ORDINAIS: Record<string, string> = {
  primeiro: "1", primeira: "1", segundo: "2", segunda: "2", terceiro: "3", terceira: "3",
  quarto: "4", quarta: "4", quinto: "5", quinta: "5", sexto: "6", sexta: "6",
  setimo: "7", setima: "7", oitavo: "8", oitava: "8", nono: "9", nona: "9",
  decimo: "10", decima: "10", terreo: "0",
};

function normLoc(s: string): string[] {
  return norm(s)
    .replace(/[ºª°]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => ORDINAIS[t] ?? t);
}

export interface LocMatch {
  id: string;
  path: string;
  score: number;
}

/**
 * Casa texto livre ("segundo andar lado A") contra a estrutura completa.
 * Números/ordinais valem mais; exige nº ou ≥2 tokens para não chutar.
 */
export function matchLocation(text: string, locations: { id: string; path: string }[]): LocMatch[] {
  const input = normLoc(text);
  if (input.length === 0) return [];
  const isNum = (t: string) => /^\d+$/.test(t);
  const scored: LocMatch[] = locations.map((l) => {
    const pt = normLoc(l.path);
    const set = new Set(pt);
    let score = 0;
    for (const t of input) {
      if (set.has(t)) score += isNum(t) ? 3 : 1;
    }
    // Bônus: todos os números do input presentes no caminho.
    const nums = input.filter(isNum);
    if (nums.length > 0 && nums.every((n) => set.has(n))) score += 2;
    return { id: l.id, path: l.path, score };
  });
  const hasNum = input.some(isNum);
  return scored
    .filter((s) => (hasNum ? s.score >= 4 : s.score >= 2))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
