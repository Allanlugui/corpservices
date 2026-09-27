import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

const TABLES = [
  "organizations",
  "departments",
  "profiles",
  "app_roles",
  "app_permissions",
  "role_permissions",
  "tickets",
  "ticket_messages",
  "ticket_attachments",
  "ticket_events",
  "work_orders",
  "pause_reasons",
  "work_order_pauses",
  "work_order_checklists",
  "work_order_materials",
  "work_order_events",
  "purchase_requests",
  "purchase_request_items",
  "purchase_quotes",
  "purchase_orders",
  "purchase_events",
  "suppliers",
  "product_categories",
  "products",
  "product_batches",
  "inventory_movements",
  "files",
  "notifications",
  "ai_conversations",
  "ai_messages",
  "ai_actions",
  "audit_events",
  "system_logs",
  "app_settings",
  "goals",
  "email_queue",
  "email_signatures",
  "push_subscriptions",
];

/**
 * Backup/migração (D-21): exporta dados + esquema + mapa de coleções.
 * Somente admin. Não é replicação ao vivo: cada destino exige importação
 * com os scripts do próprio banco (documentado no campo `restore_notes`).
 */
export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (session.role !== "admin") {
      return fail("FORBIDDEN", "Backup restrito ao administrador.", 403);
    }
    const url = new URL(request.url);
    const parsed = z.object({ target: z.enum(["supabase", "mongodb", "mariadb"]).default("supabase") }).safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("VALIDATION", "Destino invalido.", 422);
    const admin = createAdminClient();

    // information_schema não é exposta via postgREST; usa pg_attribute via SQL direto é
    // impossível pelo client — documenta o esquema a partir do código-fonte das migrations.
    // Para honestidade, o bundle carrega os dados + lista de tabelas; o DDL vive em supabase/migrations/.
    const data: Record<string, unknown[]> = {};
    let rows = 0;
    for (const table of TABLES) {
      const res = await admin.from(table).select("*").limit(5000);
      const list = (res.data ?? []) as unknown[];
      data[table] = list;
      rows += list.length;
    }

    const mongo_map: Record<string, string> = {};
    for (const table of TABLES) mongo_map[table] = `db.${table}.insertMany(<rows>) — _id: usar id (uuid string)`;
    const restore_notes =
      parsed.data.target === "supabase"
        ? "Restaurar com pg_restore/psql aplicando supabase/migrations/ na ordem e depois INSERT dos rows (respeitar FKs: organizations primeiro)."
        : parsed.data.target === "mongodb"
          ? "Criar collections conforme mongo_map; inserir rows como documentos (uuid como string); recriar índices de files.path único e tickets.client_key único; RLS não existe no Mongo — aplicar controle na aplicação."
          : "Criar tabelas a partir de supabase/migrations/ (sintaxe Postgres; ajustar tipos: uuid→CHAR(36), timestamptz→DATETIME, jsonb→JSON, numeric→DECIMAL); importar rows; recriar índices únicos.";

    return ok({
      meta: {
        app: "corpservices",
        target: parsed.data.target,
        generated_at: new Date().toISOString(),
        tables: TABLES.length,
        rows,
        ddl_source: "supabase/migrations/*.sql (versionado no Git)",
      },
      schema_note: "Esquema canônico = arquivos supabase/migrations/ no repositório (DDL Postgres).",
      mongo_map: parsed.data.target === "mongodb" ? mongo_map : undefined,
      restore_notes,
      data,
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
