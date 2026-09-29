import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { ROLES } from "@/domain/rbac";

/**
 * Config por perfil (tipo de usuário), editada pelo gestor (Fase 30).
 * Campos com consumidor real:
 * - tecnico.checklist_foto_default: foto padrão ao criar item de checklist
 * - gestor.sla_aviso_percent: % do SLA que dispara "próximo do limite"
 * - estoque.movimento_exige_motivo: motivo obrigatório nas movimentações
 */
export const ROLE_FIELDS: Record<string, { key: string; label: string; type: "bool" | "number"; min?: number; max?: number; def: number | boolean; help: string }[]> = {
  tecnico: [
    { key: "checklist_foto_default", label: "Foto obrigatória padrão", type: "bool", def: false, help: "Novos itens de checklist já nascem exigindo foto." },
  ],
  gestor: [
    { key: "sla_aviso_percent", label: "Alerta de SLA (%)", type: "number", min: 5, max: 50, def: 20, help: "Avisa quando resta menos que esse % do prazo." },
  ],
  estoque: [
    { key: "custo_obrigatorio", label: "Custo obrigatório", type: "bool", def: false, help: "Cadastro de produto exige custo maior que zero." },
  ],
  comprador: [],
  solicitante: [],
  auditor: [],
  admin: [],
};

export async function getRoleConfig(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  role: string,
): Promise<Record<string, number | boolean>> {
  const defs: Record<string, number | boolean> = {};
  for (const f of ROLE_FIELDS[role] ?? []) defs[f.key] = f.def;
  try {
    const { data } = await admin.from("role_settings").select("config").eq("org_id", orgId).eq("role_key", role).maybeSingle();
    const saved = ((data as { config: Record<string, unknown> } | null)?.config) ?? {};
    for (const [k, v] of Object.entries(saved)) {
      if (k in defs && (typeof v === "number" || typeof v === "boolean")) defs[k] = v;
    }
  } catch {
    /* padrão */
  }
  return defs;
}

export async function GET() {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "read")) return fail("FORBIDDEN", "Sem permissao.", 403);
    const admin = createAdminClient();
    const entries = await Promise.all(
      (Object.keys(ROLE_FIELDS) as (keyof typeof ROLE_FIELDS)[]).map(async (role) => ({
        role,
        fields: ROLE_FIELDS[role],
        values: await getRoleConfig(admin, session.orgId, role),
      })),
    );
    return ok({ roles: entries });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Somente admin/gestor.", 403);
    const parsed = z.object({
      role: z.enum(ROLES),
      key: z.string().min(1).max(80),
      value: z.union([z.number(), z.boolean()]),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    const def = (ROLE_FIELDS[parsed.data.role] ?? []).find((f) => f.key === parsed.data.key);
    if (!def) return fail("UNKNOWN_KEY", "Campo desconhecido para este perfil.", 422);
    if (def.type === "number" && typeof parsed.data.value === "number") {
      if (parsed.data.value < (def.min ?? 0) || parsed.data.value > (def.max ?? 100)) {
        return fail("OUT_OF_RANGE", `Valor entre ${def.min} e ${def.max}.`, 422);
      }
    }
    if (def.type === "bool" && typeof parsed.data.value !== "boolean") {
      return fail("VALIDATION", "Esperado verdadeiro/falso.", 422);
    }
    const admin = createAdminClient();
    const current = await getRoleConfig(admin, session.orgId, parsed.data.role);
    current[parsed.data.key] = parsed.data.value;
    const { error } = await admin.from("role_settings").upsert({
      org_id: session.orgId,
      role_key: parsed.data.role,
      config: current,
      updated_at: new Date().toISOString(),
    });
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    await admin.from("system_logs").insert({
      level: "info",
      source: "settings",
      message: `Config ${parsed.data.role}.${parsed.data.key} = ${parsed.data.value}`,
      user_id: session.userId,
    });
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
