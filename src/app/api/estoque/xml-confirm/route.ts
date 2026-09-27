import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { incompleteFields } from "@/domain/inventory";

/**
 * M-01/M-02: lançamento em lote APÓS revisão. Cada item decide:
 * - product_id existente => só movimenta (sem duplicar) + histórico completo;
 * - sem product_id => cria produto (tolerante) + movimenta.
 */
const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.string().trim().min(1).max(20).default("un"),
  quantity: z.number().min(0).max(1000000),
  cost_cents: z.number().int().min(0).default(0),
  barcode: z.string().trim().max(60).nullable().default(null),
  category: z.string().trim().max(80).optional(),
  supplier_id: z.string().uuid().nullable().default(null),
  product_id: z.string().uuid().nullable().default(null),
  issuer: z.string().trim().max(160).default("NF-e"),
});

const confirmSchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
  xml: z.string().min(50).max(2_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Itens invalidos.", 422);
    const admin = createAdminClient();
    // F-02: o XML original é salvo como arquivo e vinculado ao primeiro produto.
    let xmlPath: string | null = null;
    if (parsed.data.xml) {
      xmlPath = `${session.orgId}/nota_fiscal_xml/${crypto.randomUUID()}.xml`;
      await admin.storage.from("attachments").upload(xmlPath, new TextEncoder().encode(parsed.data.xml), {
        contentType: "text/xml",
        upsert: false,
      });
    }
    const result: { name: string; action: "movimentado" | "criado"; quantity: number; cadastro_incompleto: boolean }[] = [];
    for (const item of parsed.data.items) {
      if (item.product_id) {
        // Mesmo produto confirmado: só movimenta + histórico rastreável.
        const { data: product } = await admin.from("products").select("id, quantity, name").eq("id", item.product_id).eq("org_id", session.orgId).single();
        if (!product) return fail("NOT_FOUND", `Produto ${item.name} nao encontrado.`, 404);
        if (item.quantity > 0) {
          await admin.from("inventory_movements").insert({
            org_id: session.orgId,
            product_id: product.id,
            kind: "entrada",
            quantity: item.quantity,
            reason: `NF-e ${item.issuer} (unificado a cadastro existente)`,
            actor_profile_id: session.userId,
          });
          await admin.from("products").update({ quantity: Number(product.quantity) + item.quantity }).eq("id", product.id);
        }
        result.push({ name: product.name as string, action: "movimentado", quantity: item.quantity, cadastro_incompleto: false });
      } else {
        // Trava anti-duplicata: nome idêntico (case-insensitive) já cadastrado
        // exige unificação explícita — nunca cria silenciosamente.
        const { data: dup } = await admin
          .from("products")
          .select("id, name, quantity")
          .eq("org_id", session.orgId)
          .ilike("name", item.name)
          .limit(3);
        if (dup && dup.length > 0) {
          return fail("DUPLICATE_EXISTS", `“${item.name}” já existe no cadastro. Selecione unificar na revisão.`, 409, {
            candidates: dup.map((d) => ({ product_id: d.id, name: d.name, quantity: d.quantity })),
          });
        }
        const missing = incompleteFields({ name: item.name, unit: item.unit, cost: item.cost_cents || null });
        const { data: product, error } = await admin
          .from("products")
          .insert({
            org_id: session.orgId,
            name: item.name,
            unit: item.unit,
            cost_cents: item.cost_cents,
            barcode: item.barcode,
            supplier_id: item.supplier_id,
            quantity: item.quantity,
            notes: `Entrada via NF-e (${item.issuer})`,
            cadastro_incompleto: missing.length > 0,
          })
          .select("id")
          .single();
        if (error || !product) return fail("DB_INSERT", `Falha em ${item.name}.`, 500);
        if (item.quantity > 0) {
          await admin.from("inventory_movements").insert({
            org_id: session.orgId,
            product_id: product.id,
            kind: "entrada",
            quantity: item.quantity,
            reason: `NF-e ${item.issuer}`,
            actor_profile_id: session.userId,
          });
        }
        result.push({ name: item.name, action: "criado", quantity: item.quantity, cadastro_incompleto: missing.length > 0 });
      }
    }
    if (xmlPath) {
      const { data: firstCreated } = await admin
        .from("products")
        .select("id")
        .eq("org_id", session.orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const firstId = (firstCreated as { id: string } | null)?.id;
      if (firstId) {
        await admin.from("files").insert({
          org_id: session.orgId,
          owner_type: "product",
          owner_id: firstId,
          folder: "nota_fiscal",
          path: xmlPath,
          name: `nfe-${new Date().toISOString().slice(0, 10)}.xml`,
          mime: "text/xml",
          size_bytes: parsed.data.xml?.length ?? 0,
          uploaded_by: session.userId,
        });
      }
    }
    return ok({ items: result, xml_saved: !!xmlPath }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
