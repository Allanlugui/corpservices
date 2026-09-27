import "server-only";
import { DeterministicProvider, type AIProvider, type TicketKind, type TriageInput, type TriageResult } from "@/domain/botia";

/**
 * GeminiProvider (Fase 10): LLM atrás da interface AIProvider (D-07).
 * Regras: JSON estrito validado; qualquer falha → fallback determinístico.
 * Nunca decide: só sugere kind + faltantes (humano confirma na triagem).
 */

const MODEL = "gemini-2.0-flash";

function parseTriageJson(text: string, fallbackKind: TicketKind): { suggestedKind: TicketKind; missingFields: string[]; summary: string } | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const kind = obj["suggested_kind"] === "compra" ? "compra" : obj["suggested_kind"] === "servico" ? "servico" : fallbackKind;
    const missing = Array.isArray(obj["missing_fields"]) ? (obj["missing_fields"] as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 10) : [];
    const summary = typeof obj["summary"] === "string" ? (obj["summary"] as string).slice(0, 200) : "";
    return { suggestedKind: kind, missingFields: missing, summary };
  } catch {
    return null;
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini-2.0-flash";
  private fallback = new DeterministicProvider();

  constructor(private apiKey: string) {}

  async triage(input: TriageInput): Promise<TriageResult> {
    try {
      const prompt = [
        "Você tria chamados de manutenção/compras de uma empresa. Responda SOMENTE JSON:",
        '{"suggested_kind":"servico"|"compra","missing_fields":["..."],"summary":"..."}',
        `Tipo informado pelo solicitante: ${input.kind}`,
        `Campos: ${JSON.stringify(input.fields).slice(0, 1500)}`,
        "missing_fields: lista curta em pt-BR do que falta para executar (ex: local, prazo, quantidade).",
        "summary: resumo em 1 linha, sem dados sensíveis.",
      ].join("\n");
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) return this.fallback.triage(input);
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const parsed = parseTriageJson(text, input.kind);
      if (!parsed) return this.fallback.triage(input);
      // Empate/dúvida: respeita o humano (mesma regra do determinístico).
      return { ...parsed, summary: parsed.summary || (await this.fallback.triage(input)).summary };
    } catch {
      return this.fallback.triage(input);
    }
  }
}

/** Fábrica honesta: sem chave → determinístico (status visível no health). */
export function resolveBotProvider(): AIProvider {
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim()) return new GeminiProvider(key.trim());
  return new DeterministicProvider();
}

export function llmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}
