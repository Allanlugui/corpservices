import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { findMatches, parseNFe, resolveSupplier } from "@/lib/nfe";

/**
 * M-01: pré-visualização da NF-e SEM salvar. Devolve itens extraídos +
 * candidatos a duplicata (M-02) para revisão/edição antes do lançamento.
 */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "update")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const parsed = z.object({ xml: z.string().min(50).max(2_000_000) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "XML ausente.", 422);
    let nfe;
    try {
      nfe = parseNFe(parsed.data.xml);
    } catch (e) {
      return fail("XML_PARSE", e instanceof Error ? e.message : "XML invalido.", 422);
    }
    const admin = createAdminClient();
    const supplier = await resolveSupplier(admin, session.orgId, nfe.issuer, nfe.issuerDoc);
    const items = await Promise.all(
      nfe.items.map(async (item, index) => ({
        index,
        ...item,
        matches: await findMatches(admin, session.orgId, item),
      })),
    );
    return ok({
      issuer: nfe.issuer,
      supplier_id: supplier.id,
      supplier_created: supplier.created,
      items,
    });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
