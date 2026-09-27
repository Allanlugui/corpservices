import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { canWithOverlay, parseRole, type Action, type Module, type PermOverlay, type Role } from "@/domain/rbac";

export interface SessionProfile {
  userId: string;
  email: string;
  orgId: string;
  role: Role;
  displayName: string | null;
  overlay: PermOverlay[];
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Autorização efetiva da sessão: papel + overlay por usuário. */
export function canSession(session: SessionProfile, module: Module, action: Action): boolean {
  return canWithOverlay(session.role, module, action, session.overlay ?? []);
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
  const { data: perms } = await admin
    .from("user_permissions")
    .select("module, action, allowed")
    .eq("org_id", profile.org_id)
    .eq("user_id", user.id);
  return {
    userId: user.id,
    email: user.email,
    orgId: profile.org_id as string,
    role,
    displayName: (profile.display_name as string | null) ?? null,
    overlay: ((perms ?? []) as PermOverlay[]).filter((p) => typeof p.module === "string"),
  };
}
