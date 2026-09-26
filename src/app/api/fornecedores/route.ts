import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";

export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data } = await admin.from("suppliers").select("id, name, doc, contact").eq("org_id", session.orgId).order("name");
    return ok({ suppliers: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const parsed = z.object({
      name: z.string().trim().min(1).max(160),
      doc: z.string().trim().max(30).optional(),
      contact: z.string().trim().max(200).optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("suppliers")
      .insert({ org_id: session.orgId, ...parsed.data })
      .select("id")
      .single();
    if (error || !data) return fail("DB_INSERT", "Nao foi possivel criar (nome duplicado?).", 422);
    return ok({ id: data.id }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
