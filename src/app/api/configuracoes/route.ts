import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

/**
 * Parâmetros por org. SOMENTE chaves com consumidor real (ver SETTINGS).
 * Leitura: qualquer autenticado. Escrita: admin/gestor. Auditoria via system_logs.
 */
export const SETTINGS = {
  os_sla_days_default: {
    label: "SLA padrão da OS (dias)",
    type: "number" as const,
    min: 1,
    max: 365,
    default: 10,
    consumer: "POST /api/os (sla_days padrão)",
  },
  stock_expiry_warn_days: {
    label: "Alerta de validade (dias antes)",
    type: "number" as const,
    min: 1,
    max: 365,
    default: 30,
    consumer: "GET /api/estoque/alertas",
  },
  files_max_mb: {
    label: "Tamanho máximo de upload (MB)",
    type: "number" as const,
    min: 1,
    max: 50,
    default: 10,
    consumer: "POST /api/arquivos",
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;

export async function getSetting(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  key: SettingKey,
): Promise<number> {
  const def = SETTINGS[key].default;
  try {
    const { data } = await admin.from("app_settings").select("value").eq("org_id", orgId).eq("key", key).maybeSingle();
    const v = (data as { value: unknown } | null)?.value;
    const n = typeof v === "number" ? v : Number((v as { value?: unknown } | null)?.value ?? v);
    if (!Number.isFinite(n)) return def;
    return Math.min(SETTINGS[key].max, Math.max(SETTINGS[key].min, n));
  } catch {
    return def;
  }
}

export async function GET() {
  try {
    const session = await requireProfile();
    const admin = createAdminClient();
    const entries = await Promise.all(
      (Object.keys(SETTINGS) as SettingKey[]).map(async (key) => ({
        key,
        ...SETTINGS[key],
        value: await getSetting(admin, session.orgId, key),
      })),
    );
    return ok({ settings: entries });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireProfile();
    if (session.role !== "admin" && session.role !== "gestor") {
      return fail("FORBIDDEN", "Somente gestor/admin.", 403);
    }
    const parsed = z.object({ key: z.string(), value: z.number() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Payload invalido.", 422);
    if (!(parsed.data.key in SETTINGS)) return fail("UNKNOWN_KEY", "Parâmetro desconhecido.", 422);
    const def = SETTINGS[parsed.data.key as SettingKey];
    if (parsed.data.value < def.min || parsed.data.value > def.max) {
      return fail("OUT_OF_RANGE", `Valor entre ${def.min} e ${def.max}.`, 422);
    }
    const admin = createAdminClient();
    const { error } = await admin.from("app_settings").upsert({
      org_id: session.orgId,
      key: parsed.data.key,
      value: parsed.data.value,
      updated_at: new Date().toISOString(),
    });
    if (error) return fail("DB_ERROR", "Não foi possível salvar (migration pendente?).", 500);
    await admin.from("system_logs").insert({
      level: "info",
      source: "settings",
      message: `Parâmetro ${parsed.data.key} alterado para ${parsed.data.value}`,
      user_id: session.userId,
    });
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
