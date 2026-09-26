/** Domínio de estoque: funções puras (sem I/O). */

export type MovementKind = "entrada" | "saida" | "ajuste";

/** Novo saldo após movimentação. Saída nunca deixa negativo (bloqueia antes). */
export function applyMovement(current: number, kind: MovementKind, quantity: number, adjustTo?: number): number {
  if (quantity <= 0) throw new Error("Quantidade deve ser positiva.");
  if (kind === "entrada") return current + quantity;
  if (kind === "saida") {
    if (quantity > current) throw new Error("Saldo insuficiente para a saída.");
    return current - quantity;
  }
  if (adjustTo === undefined) throw new Error("Ajuste exige saldo final.");
  if (adjustTo < 0) throw new Error("Saldo não pode ser negativo.");
  return adjustTo;
}

export type StockAlert = "zerado" | "baixo" | "ok" | "excesso";

export function stockAlert(quantity: number, min: number, max: number): StockAlert {
  if (quantity <= 0) return "zerado";
  if (min > 0 && quantity < min) return "baixo";
  if (max > 0 && quantity > max) return "excesso";
  return "ok";
}

export type ExpiryAlert = "vencido" | "proximo" | "ok" | "nao_aplicavel";

export function expiryAlert(expiresAt: string | null, now: number, warnDays = 30): ExpiryAlert {
  if (!expiresAt) return "nao_aplicavel";
  const diff = Date.parse(expiresAt) - now;
  if (Number.isNaN(diff)) return "nao_aplicavel";
  if (diff < 0) return "vencido";
  if (diff <= warnDays * 86_400_000) return "proximo";
  return "ok";
}

/** Entrada tolerante (D-11): campos ausentes geram pendência, nunca bloqueio. */
export function incompleteFields(input: { name?: string; unit?: string; category?: string; cost?: number | null }): string[] {
  const missing: string[] = [];
  if (!input.name?.trim()) missing.push("nome");
  if (!input.unit?.trim()) missing.push("unidade");
  if (!input.category?.trim()) missing.push("categoria");
  if (input.cost === undefined || input.cost === null) missing.push("custo");
  return missing;
}
