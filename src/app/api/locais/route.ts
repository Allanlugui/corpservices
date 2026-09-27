import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

/** Estrutura física (árvore). Leitura: autenticado. Escrita: admin/gestor. */
export async function GET() {
  try {
    const session = await requireProfile();
    const admin = createAdminClient();
    const { data } = await admin
      .from("locations")
      .select("id, parent_id, name, active, created_at")
      .eq("org_id", session.orgId)
      .order("name");
    return ok({ locations: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      parent_id: z.string().uuid().nullable().default(null),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Nome invalido.", 422);
    const admin = createAdminClient();
    if (parsed.data.parent_id) {
      const { data: p } = await admin.from("locations").select("id").eq("id", parsed.data.parent_id).eq("org_id", session.orgId).maybeSingle();
      if (!p) return fail("NOT_FOUND", "Local pai nao encontrado.", 404);
    }
    const { data, error } = await admin.from("locations").insert({
      org_id: session.orgId,
      parent_id: parsed.data.parent_id,
      name: parsed.data.name,
    }).select("id").single();
    if (error) return fail("DB_ERROR", "Nome duplicado neste nível?", 422);
    return ok({ id: (data as { id: string }).id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
