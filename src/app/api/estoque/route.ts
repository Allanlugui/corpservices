import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { incompleteFields } from "@/domain/inventory";
import { pageParams } from "@/lib/pagination";

const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  unit: z.string().trim().min(1).max(20).default("un"),
  category: z.string().trim().max(80).optional(),
  supplier_id: z.string().uuid().optional(),
  location: z.string().trim().max(120).optional(),
  stock_min: z.number().min(0).default(0),
  stock_max: z.number().min(0).default(0),
  cost_cents: z.number().int().min(0).default(0),
  sku: z.string().trim().max(60).optional(),
  internal_code: z.string().trim().max(60).optional(),
  barcode: z.string().trim().max(60).optional(),
  manufacturer: z.string().trim().max(120).optional(),
  warranty_months: z.number().int().min(0).max(240).optional(),
  support_months: z.number().int().min(0).max(240).optional(),
  ncm: z.string().trim().max(20).optional(),
  weight_kg: z.number().min(0).max(1000000).optional(),
  notes: z.string().trim().max(2000).default(""),
});

async function categoryId(admin: ReturnType<typeof createAdminClient>, orgId: string, name?: string) {
  if (!name) return null;
  const { data } = await admin.from("product_categories").select("id").eq("org_id", orgId).eq("name", name).maybeSingle();
  if (data) return data.id as string;
  const { data: created } = await admin.from("product_categories").insert({ org_id: orgId, name }).select("id").single();
  return (created?.id as string) ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase();
    const alert = url.searchParams.get("alert");
    const { page, pageSize, from, to } = pageParams({
      page: url.searchParams.get("page"),
      page_size: url.searchParams.get("page_size") ?? "100",
    });
    const admin = createAdminClient();
    const { data, error, count } = await admin
      .from("products")
      .select("id, name, unit, location, stock_min, stock_max, quantity, cost_cents, sku, cadastro_incompleto, active, category_id", { count: "exact" })
      .eq("org_id", session.orgId)
      .eq("active", true)
      .order("name")
      .range(from, to);
    if (error) return fail("DB_QUERY", "Nao foi possivel listar.", 500);
    let rows = data ?? [];
    if (q) rows = rows.filter((p) => (p.name as string).toLowerCase().includes(q));
    if (alert === "incompleto") rows = rows.filter((p) => p.cadastro_incompleto);
    if (alert === "baixo") rows = rows.filter((p) => Number(p.stock_min) > 0 && Number(p.quantity) < Number(p.stock_min) && Number(p.quantity) > 0);
    if (alert === "zerado") rows = rows.filter((p) => Number(p.quantity) <= 0);
    if (alert === "excesso") rows = rows.filter((p) => Number(p.stock_max) > 0 && Number(p.quantity) > Number(p.stock_max));
    // Nota: filtros q/alert aplicam-se à janela carregada (page_size padrão 100); total = produtos da org.
    return ok({ products: rows, page, page_size: pageSize, total: count ?? rows.length });
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
    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Campos invalidos.", 422, parsed.error.flatten().fieldErrors);
    const admin = createAdminClient();
    const catId = await categoryId(admin, session.orgId, parsed.data.category);
    const missing = incompleteFields({ name: parsed.data.name, unit: parsed.data.unit, category: parsed.data.category, cost: parsed.data.cost_cents });
    const { data, error } = await admin
      .from("products")
      .insert({
        org_id: session.orgId,
        name: parsed.data.name,
        description: parsed.data.description,
        unit: parsed.data.unit || "un",
        category_id: catId,
        supplier_id: parsed.data.supplier_id ?? null,
        location: parsed.data.location ?? null,
        stock_min: parsed.data.stock_min,
        stock_max: parsed.data.stock_max,
        cost_cents: parsed.data.cost_cents,
        sku: parsed.data.sku ?? null,
        internal_code: parsed.data.internal_code ?? null,
        barcode: parsed.data.barcode ?? null,
        manufacturer: parsed.data.manufacturer ?? null,
        warranty_months: parsed.data.warranty_months ?? null,
        support_months: parsed.data.support_months ?? null,
        ncm: parsed.data.ncm ?? null,
        weight_kg: parsed.data.weight_kg ?? null,
        notes: parsed.data.notes,
        cadastro_incompleto: missing.length > 0,
      })
      .select("id")
      .single();
    if (error || !data) return fail("DB_INSERT", "Nao foi possivel criar.", 500);
    return ok({ id: data.id, cadastro_incompleto: missing.length > 0, pendencias: missing }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
