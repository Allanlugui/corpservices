import "server-only";

/**
 * Bot conversacional real (B5 v2): o LLM conduz com contexto — extrai
 * vários campos por mensagem, referencia o que o usuário disse e pergunta
 * o próximo passo. Contrato JSON estrito; sem chave/falha → fallback
 * roteirizado no cliente (nunca trava).
 */

export interface ChatCollected {
  kind: "servico" | "compra" | null;
  name: string;
  email: string;
  locationId: string;
  locationDetail: string;
  fields: Record<string, string>;
}

export interface ChatMsg {
  from: "user" | "bot";
  text: string;
}

export interface ChatReply {
  reply: string;
  options?: string[];
  set: Partial<{
    kind: "servico" | "compra";
    name: string;
    email: string;
    locationId: string;
    locationDetail: string;
    fields: Record<string, string>;
  }>;
  ready: boolean;
}

const MODEL = "gemini-2.0-flash";

function slots(kind: "servico" | "compra" | null): string {
  if (kind === "servico") return "campos que faltam (alguns de): descricao do problema, prioridade (baixa/media/alta/critica), equipamento (opcional)";
  if (kind === "compra") return "campos que faltam (alguns de): item, quantidade, prazo, criticidade (baixa/media/alta/critica), justificativa";
  return "primeiro descubra se é MANUTENÇÃO/SERVIÇO ou COMPRA";
}

export async function chatTurn(
  apiKey: string,
  history: ChatMsg[],
  collected: ChatCollected,
  locations: { id: string; path: string }[],
): Promise<ChatReply | null> {
  try {
    const locList = locations.slice(0, 30).map((l) => `${l.id}=${l.path}`).join("\n");
    const prompt = [
      "Você é o assistente de abertura de chamados da empresa. Fale pt-BR, curto, contextual (cite o que o usuário disse).",
      "Extraia o MÁXIMO de campos da última mensagem. Pergunte UMA coisa por vez (a mais importante).",
      `Slots: kind (servico|compra). Dados: nome, email. Local: locationId (use a lista) ou locationDetail (texto). Depois: ${slots(collected.kind)}.`,
      `Estado atual: ${JSON.stringify(collected).slice(0, 1200)}`,
      "Local: case por aproximação — ex: 'segundo andar lado A' casa com 'Unidade Pinheiros › 2° andar › Lado A' (converta ordinais: segundo=2). Sem correspondência, guarde o texto em locationDetail.",
      "Quando TODOS os obrigatórios estiverem preenchidos (nome, email válido, campos do tipo), ready=true e reply=resumo + pergunta de confirmação.",
      "Responda SOMENTE JSON: {\"reply\":\"...\",\"options\":[\"...\"],\"set\":{\"kind\":\"...\",\"name\":\"...\",\"email\":\"...\",\"locationId\":\"...\",\"locationDetail\":\"...\",\"fields\":{}},\"ready\":false}.",
      "options: até 4 respostas rápidas quando fizer sentido (tipo, prioridade, sim/não). Omita quando não.",
      `Locais (id=caminho):\n${locList || "(nenhum cadastrado)"}`,
      "Conversa (antiga primeiro):",
      ...history.slice(-10).map((m) => `${m.from === "user" ? "USUÁRIO" : "ASSISTENTE"}: ${m.text.slice(0, 500)}`),
    ].join("\n");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<ChatReply> & { set?: Record<string, unknown> };
    if (typeof obj.reply !== "string" || !obj.reply.trim()) return null;
    const set = (obj.set ?? {}) as ChatReply["set"];
    // Higieniza: só passa o que é válido.
    if (set.kind !== "servico" && set.kind !== "compra") delete set.kind;
    if (typeof set.email === "string" && !/.+@.+\..+/.test(set.email)) delete set.email;
    for (const k of ["name", "email", "locationId", "locationDetail"] as const) {
      if (set[k] !== undefined && typeof set[k] !== "string") delete set[k];
    }
    if (set.fields && typeof set.fields === "object") {
      for (const [k, v] of Object.entries(set.fields)) {
        if (typeof v !== "string") delete (set.fields as Record<string, unknown>)[k];
        else (set.fields as Record<string, string>)[k] = v.slice(0, 1000);
      }
    }
    return {
      reply: obj.reply.slice(0, 600),
      options: Array.isArray(obj.options) ? obj.options.filter((o): o is string => typeof o === "string").slice(0, 4) : undefined,
      set,
      ready: obj.ready === true,
    };
  } catch {
    return null;
  }
}
