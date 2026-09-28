import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { chatTurn } from "@/lib/bot-chat";

const msgSchema = z.object({ from: z.enum(["user", "bot"]), text: z.string().min(1).max(1000) });

const schema = z.object({
  messages: z.array(msgSchema).min(1).max(12),
  collected: z.object({
    kind: z.enum(["servico", "compra"]).nullable(),
    name: z.string().max(120).default(""),
    email: z.string().max(160).default(""),
    locationId: z.string().max(80).default(""),
    locationDetail: z.string().max(300).default(""),
    fields: z.record(z.string(), z.string().max(1000)).default({}),
  }),
  locations: z.array(z.object({ id: z.string().max(80), path: z.string().max(160) })).max(40).default([]),
});

/** Turno do bot real: LLM com contexto; null → cliente usa o roteiro local. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Conversa invalida.", 422);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return ok({ fallback: true });
  const reply = await chatTurn(key, parsed.data.messages, {
    kind: parsed.data.collected.kind,
    name: parsed.data.collected.name,
    email: parsed.data.collected.email,
    locationId: parsed.data.collected.locationId,
    locationDetail: parsed.data.collected.locationDetail,
    fields: parsed.data.collected.fields,
  }, parsed.data.locations);
  if (!reply) return ok({ fallback: true });
  return ok({ fallback: false, ...reply });
}
