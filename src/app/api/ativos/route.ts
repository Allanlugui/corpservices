import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

/** Ativos (F31 CMMS): TAG única por org, árvore, criticidade. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "work_orders", "read")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const admin = createAdminClient();
    let query = admin
      .from("assets")
      .select("id, parent_id, tag, name, description, criticality, location_id, active, created_at")
      .eq("org_id", session.orgId)
      .eq("active", true)
      .order("tag")
      .limit(200);
    if (search) query = query.or(`tag.ilike.%${search}%,name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ assets: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "work_orders", "update")) return fail("FORBIDDEN", "Somente gestor/admin.", 403);
    const parsed = z.object({
      tag: z.string().trim().min(1).max(40),
      name: z.string().trim().min(2).max(160),
      description: z.string().trim().max(1000).default(""),
      criticality: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
      location_id: z.string().uuid().nullable().optional(),
      parent_id: z.string().uuid().nullable().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Dados invalidos.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin.from("assets").insert({
      org_id: session.orgId,
      tag: parsed.data.tag.toUpperCase(),
      name: parsed.data.name,
      description: parsed.data.description,
      criticality: parsed.data.criticality,
      location_id: parsed.data.location_id ?? null,
      parent_id: parsed.data.parent_id ?? null,
    }).select("id").single();
    if (error) return fail("DB_ERROR", "TAG duplicada neste nível?", 422);
    return ok({ id: (data as { id: string }).id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
