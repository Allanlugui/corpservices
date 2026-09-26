import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

export async function GET() {
  try {
    const session = await requireProfile();
    return ok({ email: session.email, role: session.role, displayName: session.displayName });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
