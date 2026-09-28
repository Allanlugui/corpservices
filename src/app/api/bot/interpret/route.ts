import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { detectConfirm, detectKind, detectLevel } from "@/lib/bot-flow";

/**
 * Bot do portal (B5): interpreta resposta livre via Gemini com fallback
 * local. Público com limites: texto ≤500, tarefas fechadas, sem histórico
 * armazenado. LLM nunca decide — só normaliza; o fluxo é determinístico.
 */
const schema = z.object({
  task: z.enum(["kind", "level", "confirm"]),
  text: z.string().min(1).max(500),
});

async function viaGemini(task: string, text: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const ask =
      task === "kind"
        ? 'Classifique em JSON {"value":"servico"|"compra"|null}: o usuário quer MANUTENÇÃO/SERVIÇO ou COMPRAR algo?'
        : task === "level"
          ? 'Classifique em JSON {"value":"baixa"|"media"|"alta"|"critica"|null}: nível de urgência.'
          : 'Classifique em JSON {"value":true|false|null}: o usuário CONFIRMOU?';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${ask}\nResposta do usuário: ${text.slice(0, 400)}` }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 60, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as { value?: unknown };
    if (task === "kind") return obj.value === "servico" || obj.value === "compra" ? (obj.value as string) : null;
    if (task === "level") return ["baixa", "media", "alta", "critica"].includes(obj.value as string) ? (obj.value as string) : null;
    return typeof obj.value === "boolean" ? String(obj.value) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Pedido invalido.", 422);
  const { task, text } = parsed.data;

  const llm = await viaGemini(task, text);
  if (llm !== null) return ok({ value: task === "confirm" ? llm === "true" : llm, source: "gemini" });

  if (task === "kind") {
    const v = detectKind(text);
    return ok({ value: v, source: "local" });
  }
  if (task === "level") {
    const v = detectLevel(text);
    return ok({ value: v, source: "local" });
  }
  const v = detectConfirm(text);
  return ok({ value: v, source: "local" });
}
