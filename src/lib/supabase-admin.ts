import { createClient } from "@supabase/supabase-js";
import "server-only";

/**
 * Client privilegiado (service_role, BYPASSA RLS). Importar somente em
 * Route Handlers / Server Actions com autorizacao propria verificada antes.
 */
export function createAdminClient() {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error("Supabase NAO_CONFIGURADO: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.");
  }
  return createClient(url, serviceKey);
}
