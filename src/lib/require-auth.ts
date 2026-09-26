import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { parseRole, type Role } from "@/domain/rbac";

export interface SessionProfile {
  userId: string;
  email: string;
  orgId: string;
  role: Role;
  displayName: string | null;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Sessao + perfil verificados no servidor. Falha fechado: sem perfil valido, 403. */
export async function requireProfile(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new AuthError(401, "Nao autenticado.");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, role_key, display_name")
    .eq("id", user.id)
    .single();
  const role = parseRole(profile?.role_key);
  if (!profile || !role) throw new AuthError(403, "Perfil sem papel valido.");
  return {
    userId: user.id,
    email: user.email,
    orgId: profile.org_id as string,
    role,
    displayName: (profile.display_name as string | null) ?? null,
  };
}
