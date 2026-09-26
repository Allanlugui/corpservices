import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

const querySchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  source: z.string().max(80).optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const postSchema = z.object({
  level: z.enum(["warn", "error"]),
  source: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1000),
  meta: z.record(z.string(), z.unknown()).default({}),
});

/** Logs técnicos: leitura gestor/admin/auditor; escrita warn/error autenticada. */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!["admin", "gestor", "auditor"].includes(session.role)) {
      return fail("FORBIDDEN", "Restrito.", 403);
    }
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Filtros invalidos.", 422);
    const admin = createAdminClient();
    let query = admin.from("system_logs").select("id, level, source, message, meta, user_id, created_at").order("created_at", { ascending: false }).limit(parsed.data.limit);
    if (parsed.data.level) query = query.eq("level", parsed.data.level);
    if (parsed.data.source) query = query.ilike("source", `%${parsed.data.source}%`);
    if (parsed.data.search) query = query.ilike("message", `%${parsed.data.search}%`);
    const { data, error } = await query;
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    return ok({ logs: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Log invalido.", 422);
    const admin = createAdminClient();
    await admin.from("system_logs").insert({
      level: parsed.data.level,
      source: `client:${parsed.data.source}`,
      message: parsed.data.message,
      meta: parsed.data.meta,
      user_id: session.userId,
    });
    return ok({ ok: true }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
