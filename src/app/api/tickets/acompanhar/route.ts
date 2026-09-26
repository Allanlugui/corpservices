import { z } from "zod";
import { createClient } from "@/lib/supabase-server";
import { fail, ok } from "@/lib/api";

const querySchema = z.object({ token: z.string().uuid() });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ token: url.searchParams.get("token") });
  if (!parsed.success) {
    return fail("VALIDATION", "Token de acompanhamento invalido.", 422);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ticket_by_token", {
    p_token: parsed.data.token,
  });
  if (error) return fail("DB_RPC", "Nao foi possivel consultar.", 500);
  if (!data || data.found === false) return fail("NOT_FOUND", "Solicitacao nao encontrada.", 404);
  return ok(data);
}
