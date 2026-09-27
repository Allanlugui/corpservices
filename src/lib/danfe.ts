/**
 * DANFE (PDF) — extração best-effort de texto para prévia de entrada.
 * Honestidade: PDF não tem estrutura garantida; o parser extrai o que
 * consegue (emitente + candidatos a item) e a revisão M-01 corrige o resto.
 * Entrada-xml legada e fluxo XML NF-e seguem intactos.
 */

import { incompleteFields } from "../domain/inventory";

export interface DanfeItem {
  name: string;
  quantity: number;
  unit: string;
  cost_cents: number;
  barcode: string | null;
  missing: string[];
}

export interface DanfeParsed {
  issuer: string;
  issuerDoc: string;
  items: DanfeItem[];
  warnings: string[];
}

const CNPJ_RE = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
const MONEY_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Número pt-BR ("1.234,56") → float. */
export function parseBrNumber(s: string): number {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Reconstrói linhas visuais a partir dos spans do pdfjs: agrupa por Y
 * (tolerância 3pt) e ordena por X. DANFE real não vem em ordem de
 * leitura no stream do PDF — sem isso, nada é extraído.
 */
export function groupByLine(items: unknown[]): string {
  const rows: { y: number; x: number; str: string }[] = [];
  for (const it of items) {
    const r = it as { str?: string; transform?: number[] };
    if (typeof r.str !== "string" || !r.str.trim()) continue;
    const t = Array.isArray(r.transform) ? r.transform : [1, 0, 0, 1, 0, 0];
    rows.push({ y: t[5] ?? 0, x: t[4] ?? 0, str: r.str });
  }
  rows.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  let current = "";
  let lastY = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (Math.abs(r.y - lastY) > 3 && current) {
      lines.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + r.str.trim();
    lastY = r.y;
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join("\n");
}

function toCents(v: number): number {
  return Math.max(0, Math.round(v * 100));
}

/**
 * Emitente: primeiro CNPJ encontrado; nome = linha não-vazia anterior
 * mais plausível (sem dígitos de controle, sem palavras-chave da DANFE).
 */
export function extractIssuer(lines: string[]): { issuer: string; issuerDoc: string } {
  const NOISE = /danfe|documento|auxiliar|fiscal|eletrônica|eletronica|página|pagina|chave|acesso|protocolo|natureza|operação|operacao/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CNPJ_RE);
    if (!m) continue;
    const doc = onlyDigits(m[1]);
    let name = "Emitente DANFE";
    const window: string[] = [];
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const cand = lines[j].trim();
      if (cand.length >= 3 && !NOISE.test(cand) && !CNPJ_RE.test(cand) && !/^\d+$/.test(cand.replace(/[\s./-]/g, ""))) {
        window.unshift(cand);
      }
    }
    // Razão social costuma ter sufixo societário; endereço tem número+UF.
    const corporate = window.find((c) => /\b(ltda|s\.?\s?a\.?|eireli|\bme\b|\bepp\b)\b/i.test(c));
    const noAddress = window.find((c) => !/\d{2,}|[A-Z]{2}\b/.test(c) || c.length > 30);
    name = (corporate ?? noAddress ?? window[0] ?? name).slice(0, 120);
    return { issuer: name, issuerDoc: doc };
  }
  return { issuer: "Emitente DANFE", issuerDoc: "" };
}

/**
 * Itens: linhas com ≥2 valores monetários. Heurística:
 * descrição = trecho antes do primeiro valor; quantidade = primeiro
 * número com decimais antes dos valores; unitário = penúltimo valor,
 * total = último. barcode = sequência de 8–14 dígitos isolada.
 */
export function extractItems(lines: string[]): DanfeItem[] {
  const items: DanfeItem[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 8) continue;
    const money = [...line.matchAll(MONEY_RE)].map((m) => m[1]);
    if (money.length < 2) continue;
    const firstMoneyAt = line.indexOf(money[0]);
    const head = line.slice(0, firstMoneyAt).trim();
    if (head.length < 3) continue;
    const nums = [...head.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => m[1]);
    const barcodeMatch = head.match(/\b(\d{8,14})\b/);
    const barcode = barcodeMatch ? barcodeMatch[1] : null;
    const name = head
      .replace(/\b\d{8,14}\b/, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120);
    if (name.length < 3) continue;
    const qtyRaw = nums.length > 0 ? nums[nums.length - 1] : "1";
    const quantity = parseBrNumber(qtyRaw) || 0;
    const unitPrice = parseBrNumber(money[money.length - 2]);
    const total = parseBrNumber(money[money.length - 1]);
    const cost_cents = toCents(unitPrice > 0 ? unitPrice : quantity > 0 ? total / quantity : total);
    const missing = incompleteFields({ name, unit: "un", cost: cost_cents || null });
    if (!quantity) missing.push("quantidade");
    items.push({ name, quantity, unit: "un", cost_cents, barcode, missing });
    if (items.length >= 200) break;
  }
  return items;
}

export function parseDanfeText(text: string): DanfeParsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const warnings: string[] = [];
  if (lines.length === 0) {
    return { issuer: "Emitente DANFE", issuerDoc: "", items: [], warnings: ["PDF sem texto extraível (pode ser imagem escaneada)."] };
  }
  const { issuer, issuerDoc } = extractIssuer(lines);
  if (!issuerDoc) warnings.push("CNPJ do emitente não localizado; confira o fornecedor na revisão.");
  const items = extractItems(lines);
  if (items.length === 0) warnings.push("Nenhum item identificado automaticamente; cadastre manualmente ou revise o PDF.");
  return { issuer, issuerDoc, items, warnings };
}
