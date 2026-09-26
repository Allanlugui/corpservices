/**
 * Ponto único de acesso ao Supabase. Estado: NAO_CONFIGURADO.
 * Fail-closed: sem SUPABASE_URL + SUPABASE_ANON_KEY, getSupabaseConfig() lança
 * erro explícito em vez de retornar cliente quebrado. Nenhum mock finge conexão.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase NAO_CONFIGURADO: defina SUPABASE_URL e SUPABASE_ANON_KEY " +
        "(ver .env.example). BLOQUEADO POR DEPENDENCIA EXTERNA.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

export function getSupabaseConfig(
  env: Partial<Record<string, string | undefined>> = process.env,
): SupabaseConfig {
  const url = env["SUPABASE_URL"] ?? env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = env["SUPABASE_ANON_KEY"] ?? env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) throw new SupabaseNotConfiguredError();
  return { url, anonKey };
}
