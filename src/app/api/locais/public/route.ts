import { createClient } from "@/lib/supabase-server";
import { fail, ok } from "@/lib/api";

/** Locais ativos para o portal público (id + caminho). Sem auth. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_locations");
  if (error) return fail("DB_RPC", "Nao foi possivel listar.", 500);
  return ok({ locations: data ?? [] });
}
