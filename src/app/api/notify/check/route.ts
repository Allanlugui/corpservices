import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, canSession, requireProfile } from "@/lib/require-auth";
import { notifyRoles } from "@/lib/notify";
import { getSetting } from "@/app/api/configuracoes/route";
import { getRoleConfig } from "@/app/api/configuracoes/papeis/route";

const COOLDOWN_MS = 24 * 3600 * 1000;

/**
 * Alertas proativos §24: SLA próximo/atrasado, estoque baixo, validade
 * próxima, cadastro incompleto. Anti-spam de 24h por chave. Gestor/admin
 * dispara manual (botão) ou agendador externo via CRON_SECRET.
 */
export async function POST(request: Request) {
  try {
    const cron = request.headers.get("x-cron-secret");
    let orgScope: string | null = null;
    if (!cron || cron !== process.env.CRON_SECRET) {
      const session = await requireProfile();
      if (!canSession(session, "settings", "update")) return fail("FORBIDDEN", "Sem permissao.", 403);
      orgScope = session.orgId;
    }
    const admin = createAdminClient();
    const orgs: string[] = orgScope
      ? [orgScope]
      : ((await admin.from("organizations").select("id").limit(100)).data ?? []).map((o) => (o as { id: string }).id);
    let sent = 0;

    async function fresh(orgId: string, key: string): Promise<boolean> {
      const { data } = await admin.from("alert_states").select("last_sent_at").eq("org_id", orgId).eq("alert_key", key).maybeSingle();
      const last = (data as { last_sent_at: string } | null)?.last_sent_at;
      if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) return false;
      await admin.from("alert_states").upsert({ org_id: orgId, alert_key: key, last_sent_at: new Date().toISOString() });
      return true;
    }

    for (const orgId of orgs) {
      // SLA: abertas com pouco fôlego ou estouradas (% configurável por perfil gestor).
      const gestorCfg = await getRoleConfig(admin, orgId, "gestor");
      const warnRatio = Number(gestorCfg.sla_aviso_percent ?? 20) / 100;
      const { data: wos } = await admin
        .from("work_orders")
        .select("id, number, status, sla_remaining_ms, sla_total_ms")
        .eq("org_id", orgId)
        .not("status", "in", "(ENCERRADA)")
        .limit(500);
      for (const w of wos ?? []) {
        const wo = w as { id: string; number: number; status: string; sla_remaining_ms: number; sla_total_ms: number };
        const total = Number(wo.sla_total_ms) || 1;
        const ratio = Number(wo.sla_remaining_ms) / total;
        if (Number(wo.sla_remaining_ms) <= 0 && (await fresh(orgId, `sla-atrasado-${wo.id}`))) {
          await notifyRoles(admin, orgId, ["gestor", "admin", "tecnico"], {
            kind: "sla_atrasado",
            title: `OS-${wo.number} com SLA estourado`,
            body: "Verifique a execução ou pausas.",
            link: `/os/${wo.id}`,
          });
          sent += 1;
        } else if (ratio < warnRatio && ratio >= 0 && (await fresh(orgId, `sla-proximo-${wo.id}`))) {
          await notifyRoles(admin, orgId, ["gestor", "admin", "tecnico"], {
            kind: "sla_proximo",
            title: `OS-${wo.number} perto do limite do SLA`,
            body: `Menos de ${Math.round(warnRatio * 100)}% do prazo restante.`,
            link: `/os/${wo.id}`,
          });
          sent += 1;
        }
      }
      // Estoque baixo / validade / incompleto.
      const warnDays = await getSetting(admin, orgId, "stock_expiry_warn_days");
      const { data: prods } = await admin
        .from("products")
        .select("id, name, quantity, stock_min, cadastro_incompleto")
        .eq("org_id", orgId)
        .eq("active", true)
        .limit(1000);
      for (const p of prods ?? []) {
        const pr = p as { id: string; name: string; quantity: number; stock_min: number; cadastro_incompleto: boolean };
        if (Number(pr.quantity) <= Number(pr.stock_min) && (await fresh(orgId, `estoque-baixo-${pr.id}`))) {
          await notifyRoles(admin, orgId, ["estoque", "gestor", "admin"], {
            kind: "estoque_baixo",
            title: `Estoque baixo: ${pr.name}`,
            body: `Saldo ${pr.quantity} (mínimo ${pr.stock_min}).`,
            link: `/estoque/${pr.id}`,
          });
          sent += 1;
        }
        if (pr.cadastro_incompleto && (await fresh(orgId, `incompleto-${pr.id}`))) {
          await notifyRoles(admin, orgId, ["estoque", "gestor", "admin"], {
            kind: "registro_incompleto",
            title: `Cadastro incompleto: ${pr.name}`,
            body: "Complete os dados pendentes na ficha.",
            link: `/estoque/${pr.id}`,
          });
          sent += 1;
        }
      }
      const { data: batches } = await admin
        .from("product_batches")
        .select("id, batch, expires_at, product_id, products(name)")
        .lte("expires_at", new Date(Date.now() + warnDays * 86_400_000).toISOString())
        .limit(500);
      for (const b of batches ?? []) {
        const bt = b as { id: string; batch: string; expires_at: string; product_id: string; products: { name: string }[] | null };
        // Só da org: confere via produto.
        const { data: owner } = await admin.from("products").select("org_id").eq("id", bt.product_id).maybeSingle();
        if ((owner as { org_id: string } | null)?.org_id !== orgId) continue;
        if (await fresh(orgId, `validade-${bt.id}`)) {
          await notifyRoles(admin, orgId, ["estoque", "gestor", "admin"], {
            kind: "validade_proxima",
            title: `Validade próxima: ${bt.products?.[0]?.name ?? "lote"}`,
            body: `Lote ${bt.batch ?? ""} vence em ${new Date(bt.expires_at).toLocaleDateString("pt-BR")}.`,
            link: `/estoque/${bt.product_id}`,
          });
          sent += 1;
        }
      }
    }
    return ok({ sent });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
