import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const quoteSchema = z.object({
  supplier: z.string().trim().min(1).max(160),
  amount_cents: z.number().int().min(0).max(100_000_000_00),
  currency: z.string().trim().length(3).default("BRL"),
  notes: z.string().trim().max(1000).default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "purchases", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Cotacao invalida.", 422);
    const admin = createAdminClient();
    const { data: req } = await admin.from("purchase_requests").select("id").eq("id", id).eq("org_id", session.orgId).single();
    if (!req) return fail("NOT_FOUND", "Compra nao encontrada.", 404);
    const { data, error } = await admin
      .from("purchase_quotes")
      .insert({ request_id: id, ...parsed.data, created_by: session.userId })
      .select("id")
      .single();
    if (error) return fail("DB_INSERT", "Nao foi possivel registrar.", 500);
    await admin.from("purchase_events").insert({
      request_id: id,
      event: "COTACAO_ENVIADA",
      actor_profile_id: session.userId,
      detail: { quote_id: data.id, supplier: parsed.data.supplier },
    });
    return ok({ id: data.id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    // Escolher cotacao e ato do gestor: comprador/estoque cotam, gestor decide (D-17).
    if (!canSession(session, "purchases", "approve")) {
      return fail("FORBIDDEN", "Escolha de cotacao exige gestor.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const parsed = z.object({ quote_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const admin = createAdminClient();
    const { data: req } = await admin.from("purchase_requests").select("id").eq("id", id).eq("org_id", session.orgId).single();
    if (!req) return fail("NOT_FOUND", "Compra nao encontrada.", 404);
    await admin.from("purchase_quotes").update({ chosen: false }).eq("request_id", id);
    const { error } = await admin.from("purchase_quotes").update({ chosen: true }).eq("id", parsed.data.quote_id).eq("request_id", id);
    if (error) return fail("DB_UPDATE", "Nao foi possivel escolher.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
