import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { parseNFe, resolveSupplier, type NFeItem } from "@/lib/nfe";

/**
 * Entrada por XML de NF-e (DANFE). Tolerante (D-11): itens sem campos opcionais
 * entram mesmo assim, marcados com cadastro_incompleto + pendências.
 */
const bodySchema = z.object({ xml: z.string().min(50).max(2_000_000) });

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!canSession(session, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "XML ausente.", 422);
    let nfe: { issuer: string; issuerDoc: string | null; items: NFeItem[] };
    try {
      nfe = parseNFe(parsed.data.xml);
    } catch (e) {
      return fail("XML_PARSE", e instanceof Error ? e.message : "XML invalido.", 422);
    }
    const admin = createAdminClient();
    const supplier = await resolveSupplier(admin, session.orgId, nfe.issuer, nfe.issuerDoc);
    const supplierId = supplier.id;
    const supplierCreated = supplier.created;
    const created: { name: string; quantity: number; cadastro_incompleto: boolean; pendencias: string[] }[] = [];
    for (const item of nfe.items) {
      const qty = item.quantity > 0 ? item.quantity : 0;
      const { data: product } = await admin
        .from("products")
        .insert({
          org_id: session.orgId,
          name: item.name,
          unit: item.unit,
          cost_cents: item.cost_cents,
          barcode: item.barcode,
          supplier_id: supplierId,
          quantity: qty,
          notes: `Entrada via NF-e (${nfe.issuer})`,
          cadastro_incompleto: item.missing.length > 0,
        })
        .select("id")
        .single();
      if (product && qty > 0) {
        await admin.from("inventory_movements").insert({
          org_id: session.orgId,
          product_id: product.id,
          kind: "entrada",
          quantity: qty,
          reason: `NF-e ${nfe.issuer}`,
          actor_profile_id: session.userId,
        });
      }
      created.push({ name: item.name, quantity: qty, cadastro_incompleto: item.missing.length > 0, pendencias: item.missing });
    }
    return ok({ issuer: nfe.issuer, supplier: supplierId ? nfe.issuer : null, supplier_created: supplierCreated, items: created }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
