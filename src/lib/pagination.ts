/** Paginação server-side padrão: page 1-based, page_size máx 100.
 * O zod das rotas rejeita >100 com 422; o clamp aqui é defesa em profundidade. */

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export function pageParams(input: { page?: unknown; page_size?: unknown }): { page: number; pageSize: number; from: number; to: number } {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(input.page_size) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, from: (page - 1) * pageSize, to: (page - 1) * pageSize + pageSize - 1 };
}
