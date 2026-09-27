import { XMLParser } from "fast-xml-parser";
import type { createAdminClient } from "./supabase-admin";
import { incompleteFields } from "../domain/inventory";

export interface NFeItem {
  name: string;
  quantity: number;
  unit: string;
  cost_cents: number;
  barcode: string | null;
  missing: string[];
}

export interface NFeParsed {
  issuer: string;
  issuerDoc: string | null;
  items: NFeItem[];
}

export function parseNFe(xml: string): NFeParsed {
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

export interface Match {
  product_id: string;
  name: string;
  quantity: number;
  supplier: string | null;
  by: "barcode" | "name";
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "com", "sem", "para", "por", "em", "no", "na",
  "un", "unid", "unidade", "pc", "pca", "cx", "kit", "novo", "nova", "original",
]);

/**
 * Tokens significativos: minúsculo, sem acento, só letras/números,
 * sem stopwords e sem tokens curtos. Puro e testável.
 */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Deduplicação (M-02): código de barras (forte) ou TODOS os tokens
 * significativos presentes no nome (AND). O prefixo-ilike anterior
 * falhava quando a NF-e trazia descrição mais longa que o cadastro
 * (ex: "...7320 I7/16GB..." vs "...7320") — gerava duplicatas exatas.
 * O fornecedor é exibido para julgamento, mas não exclui candidatos.
 * Nunca decide sozinho: devolve candidatos para o usuário confirmar.
 */
export async function findMatches(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  item: NFeItem,
): Promise<Match[]> {
  if (item.barcode) {
    const { data } = await admin
      .from("products")
      .select("id, name, quantity, suppliers(name)")
      .eq("org_id", orgId)
      .eq("barcode", item.barcode)
      .limit(3);
    if (data && data.length > 0) {
      return data.map((p) => ({
        product_id: p.id as string,
        name: p.name as string,
        quantity: Number(p.quantity),
        supplier: (p.suppliers as unknown as { name: string } | null)?.name ?? null,
        by: "barcode" as const,
      }));
    }
  }
  const tokens = nameTokens(item.name);
  if (tokens.length === 0) return [];
  // Relaxamento progressivo: tenta com até 6 tokens e solta o último
  // até achar (mínimo 2). Sufixos da NF-e (I7, 16GB...) não bloqueiam.
  const maxN = Math.min(6, tokens.length);
  for (let n = maxN; n >= Math.min(2, tokens.length); n--) {
    let query = admin
      .from("products")
      .select("id, name, quantity, supplier_id, suppliers(name)")
      .eq("org_id", orgId);
    for (const t of tokens.slice(0, n)) query = query.ilike("name", `%${t}%`);
    const { data } = await query.limit(5);
    if (data && data.length > 0) {
      return data.map((p) => ({
        product_id: p.id as string,
        name: p.name as string,
        quantity: Number(p.quantity),
        supplier: (p.suppliers as unknown as { name: string } | null)?.name ?? null,
        by: "name" as const,
      }));
    }
  }
  return [];
}

export async function resolveSupplier(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  issuer: string,
  issuerDoc: string | null,
): Promise<{ id: string | null; created: boolean }> {
  if (issuer === "Emitente desconhecido") return { id: null, created: false };
  const { data: existing } = await admin.from("suppliers").select("id").eq("org_id", orgId).eq("name", issuer).maybeSingle();
  if (existing) return { id: existing.id as string, created: false };
  const { data: created } = await admin
    .from("suppliers")
    .insert({ org_id: orgId, name: issuer, doc: issuerDoc, contact: "via NF-e" })
    .select("id")
    .single();
  return { id: (created?.id as string) ?? null, created: !!created };
}
