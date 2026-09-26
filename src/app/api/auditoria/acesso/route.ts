import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

/** Registra LOGIN/LOGOUT na trilha de auditoria de acesso. */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = z.object({ event: z.enum(["LOGIN", "LOGOUT"]) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Evento invalido.", 422);
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      org_id: session.orgId,
      user_id: session.userId,
      event: parsed.data.event,
      detail: { email: session.email },
    });
    return ok({ ok: true }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
