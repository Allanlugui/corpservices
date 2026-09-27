import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const session = await requireProfile();
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("avatar_url, must_reset").eq("id", session.userId).maybeSingle();
    return ok({
      userId: session.userId,
      email: session.email,
      role: session.role,
      displayName: session.displayName,
      overlay: session.overlay,
      avatarUrl: (data as { avatar_url?: string } | null)?.avatar_url ?? "",
      mustReset: Boolean((data as { must_reset?: boolean } | null)?.must_reset),
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
