import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client server-side (anon key, respeita RLS do usuario). Nunca exponha service_role aqui. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_ANON_KEY"] ?? process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de Server Component: escrita ignorada, middleware atualiza a sessao.
          }
        },
      },
    },
  );
}
