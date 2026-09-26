import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { incompleteFields } from "@/domain/inventory";

/**
 * Entrada por XML de NF-e (DANFE). Tolerante (D-11): itens sem campos opcionais
 * entram mesmo assim, marcados com cadastro_incompleto + pendências.
 */
const bodySchema = z.object({ xml: z.string().min(50).max(2_000_000) });

interface NFeItem {
  name: string;
  quantity: number;
  unit: string;
  cost_cents: number;
  barcode: string | null;
  missing: string[];
}

function parseNFe(xml: string): { issuer: string; issuerDoc: string | null; items: NFeItem[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xml);
  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe;
  if (!infNFe) throw new Error("XML sem infNFe (NF-e invalida ou formato desconhecido).");
  const issuer = infNFe.emit?.xNome ?? "Emitente desconhecido";
  const issuerDoc = infNFe.emit?.CNPJ ?? infNFe.emit?.CPF ?? null;
  const dets = Array.isArray(infNFe.det) ? infNFe.det : infNFe.det ? [infNFe.det] : [];
  const items: NFeItem[] = dets.map((d: Record<string, unknown>) => {
    const prod = (d.prod ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
    const name = str(prod.xProd) || "Item sem nome";
    const quantity = Number(str(prod.qCom)) || 0;
    const unit = str(prod.uCom) || "";
    const cost_cents = Math.round((Number(str(prod.vUnCom)) || 0) * 100);
    const barcode = str(prod.cEAN) && str(prod.cEAN) !== "SEM GTIN" ? str(prod.cEAN) : null;
    const missing = incompleteFields({ name: name === "Item sem nome" ? "" : name, unit, cost: cost_cents || null });
    if (!quantity) missing.push("quantidade");
    return { name, quantity, unit: unit || "un", cost_cents, barcode, missing };
  });
  if (items.length === 0) throw new Error("Nenhum item (det/prod) encontrado no XML.");
  return { issuer, issuerDoc, items };
}

export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "update")) {
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
    // Fornecedor do emitente: cadastra automaticamente quando inédito.
    let supplierId: string | null = null;
    let supplierCreated = false;
    if (nfe.issuer !== "Emitente desconhecido") {
      const { data: existing } = await admin.from("suppliers").select("id").eq("org_id", session.orgId).eq("name", nfe.issuer).maybeSingle();
      if (existing) supplierId = existing.id as string;
      else {
        const { data: created } = await admin
          .from("suppliers")
          .insert({ org_id: session.orgId, name: nfe.issuer, doc: nfe.issuerDoc, contact: "via NF-e" })
          .select("id")
          .single();
        if (created) {
          supplierId = created.id as string;
          supplierCreated = true;
        }
      }
    }
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
