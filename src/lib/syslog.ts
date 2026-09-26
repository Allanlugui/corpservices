import "server-only";
import { createAdminClient } from "./supabase-admin";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Log técnico do sistema (não confundir com auditoria de negócio). */
export async function sysLog(
  level: LogLevel,
  source: string,
  message: string,
  meta: Record<string, unknown> = {},
  userId?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("system_logs").insert({
      level,
      source,
      message: message.slice(0, 1000),
      meta,
      user_id: userId ?? null,
    });
  } catch {
    // Log nunca quebra o fluxo principal.
  }
}
