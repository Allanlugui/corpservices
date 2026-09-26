import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { expiryAlert, stockAlert } from "@/domain/inventory";

/** Alertas: zerado, baixo, excesso, vencido, próximo do vencimento, cadastro incompleto. */
export async function GET() {
  try {
    const session = await requireProfile();
    if (!can(session.role, "inventory", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const admin = createAdminClient();
    const { data: products } = await admin
      .from("products")
      .select("id, name, quantity, stock_min, stock_max, cadastro_incompleto")
      .eq("org_id", session.orgId)
      .eq("active", true);
    const { data: batches } = await admin
      .from("product_batches")
      .select("id, product_id, batch, expires_at, quantity, products!inner(org_id)")
      .eq("products.org_id", session.orgId)
      .gt("quantity", 0);
    const now = Date.now();
    const stock = (products ?? []).flatMap((p) => {
      const alert = stockAlert(Number(p.quantity), Number(p.stock_min), Number(p.stock_max));
      const list: { type: string; product_id: string; product: string; detail: string }[] = [];
      if (alert !== "ok") {
        list.push({
          type: alert === "zerado" ? "zerado" : alert === "baixo" ? "baixo" : "excesso",
          product_id: p.id as string,
          product: p.name as string,
          detail: `Saldo ${p.quantity}`,
        });
      }
      if (p.cadastro_incompleto) {
        list.push({ type: "incompleto", product_id: p.id as string, product: p.name as string, detail: "Cadastro incompleto" });
      }
      return list;
    });
    const names = new Map((products ?? []).map((p) => [p.id as string, p.name as string]));
    const expiry = (batches ?? []).flatMap((b) => {
      const alert = expiryAlert(b.expires_at as string | null, now);
      if (alert === "ok" || alert === "nao_aplicavel") return [];
      return [{
        type: alert === "vencido" ? "vencido" : "proximo",
        product_id: b.product_id as string,
        product: names.get(b.product_id as string) ?? "?",
        detail: `Lote ${b.batch ?? "—"} vence ${b.expires_at}`,
      }];
    });
    return ok({ alerts: [...stock, ...expiry] });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
