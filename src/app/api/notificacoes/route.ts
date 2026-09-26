import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    const url = new URL(request.url);
    const unread = url.searchParams.get("unread") === "1";
    const admin = createAdminClient();
    let query = admin
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (unread) query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .is("read_at", null);
    return ok({ notifications: data ?? [], unread: count ?? 0 });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireProfile();
    const body = await request.json().catch(() => null);
    const parsed = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const admin = createAdminClient();
    if (parsed.data.all) {
      await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
    } else if (parsed.data.id) {
      await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("user_id", session.userId);
    } else {
      return fail("VALIDATION", "Informe id ou all.", 422);
    }
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
