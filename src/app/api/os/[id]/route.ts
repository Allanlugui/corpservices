import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";
import { can } from "@/domain/rbac";
import { transitionOs, type OsStatus } from "@/domain/os-states";
import { resolveActors, withActorNames } from "@/lib/actors";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { adminFindProfile, assertAssigneeInOrg } from "@/lib/assignment";

const paramsSchema = z.object({ id: z.string().uuid() });

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), assigned_to: z.string().uuid(), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("start"), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("pause"), reason: z.string().trim().min(2).max(120), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("resume"), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("complete"), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("validate"), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("reopen"), client_key: z.string().uuid().optional() }),
  z.object({ action: z.literal("close"), client_key: z.string().uuid().optional() }),
]);

const ACTION_TO: Record<string, OsStatus> = {
  assign: "ATRIBUIDA",
  start: "EM_EXECUCAO",
  pause: "PAUSADA",
  resume: "EM_EXECUCAO",
  complete: "CONCLUIDA",
  validate: "VALIDACAO",
  reopen: "EM_EXECUCAO",
  close: "ENCERRADA",
};

const ACTION_EVENT: Record<string, string> = {
  assign: "ATRIBUIDA",
  start: "INICIADA",
  pause: "PAUSADA",
  resume: "RETOMADA",
  complete: "CONCLUIDA",
  validate: "VALIDACAO",
  reopen: "REABERTA",
  close: "ENCERRADA",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "work_orders", "read")) {
      return fail("FORBIDDEN", "Sem permissao.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const admin = createAdminClient();
    const { data: wo, error } = await admin
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .eq("org_id", session.orgId)
      .single();
    if (error || !wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
    if (session.role === "tecnico" && wo.assigned_to !== session.userId) {
      return fail("FORBIDDEN", "OS atribuida a outro tecnico.", 403);
    }
    const [{ data: pauses }, { data: checklist }, { data: materials }, { data: events }, { data: children }] =
      await Promise.all([
        admin.from("work_order_pauses").select("*").eq("work_order_id", id).order("paused_at", { ascending: true }),
        admin.from("work_order_checklists").select("*").eq("work_order_id", id).order("position"),
        admin.from("work_order_materials").select("*").eq("work_order_id", id).order("consumed_at"),
        admin.from("work_order_events").select("*").eq("work_order_id", id).order("created_at"),
        admin.from("work_orders").select("id, number, title, status").eq("parent_work_order_id", id).order("number"),
      ]);
    const named = withActorNames(events ?? [], await resolveActors((events ?? []).map((e) => e.actor_profile_id)));
    let parent = null;
    if (wo.parent_work_order_id) {
      const { data: p } = await admin.from("work_orders").select("id, number, title, status").eq("id", wo.parent_work_order_id).single();
      parent = p ?? null;
    }
    return ok({ work_order: wo, pauses: pauses ?? [], checklist: checklist ?? [], materials: materials ?? [], events: named, children: children ?? [], parent });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireProfile();
    if (!can(session.role, "work_orders", "update")) {
      return fail("FORBIDDEN", "Sem permissao para movimentar OS.", 403);
    }
    const { id } = paramsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Acao invalida.", 422);

    const admin = createAdminClient();
    const { data: wo } = await admin
      .from("work_orders")
      .select("id, status, assigned_to, sla_remaining_ms, started_at, finished_at")
      .eq("id", id)
      .eq("org_id", session.orgId)
      .single();
    if (!wo) return fail("NOT_FOUND", "OS nao encontrada.", 404);
    if (session.role === "tecnico" && wo.assigned_to !== session.userId) {
      return fail("FORBIDDEN", "OS atribuida a outro tecnico.", 403);
    }

    const from = wo.status as OsStatus;
    const action = parsed.data.action;
    // Replay idempotente: evento já aplicado retorna o estado atual sem duplicar.
    const clientKey = (parsed.data as { client_key?: string }).client_key;
    if (clientKey) {
      const { data: seen } = await admin
        .from("work_order_events")
        .select("to_status")
        .eq("work_order_id", id)
        .eq("client_key", clientKey)
        .maybeSingle();
      if (seen) return ok({ id, to: seen.to_status, deduped: true });
    }
    const to = transitionOs(from, ACTION_TO[action]);
    // OS filha aberta bloqueia conclusao/validacao/encerramento da pai.
    if ((action === "complete" || action === "validate" || action === "close")) {
      const { count } = await admin
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("parent_work_order_id", id)
        .neq("status", "ENCERRADA");
      if ((count ?? 0) > 0) {
        return fail("BLOCKED_BY_CHILDREN", "Encerre as OS filhas antes de finalizar esta OS.", 422);
      }
    }
    const now = Date.now();
    const detail: Record<string, unknown> = { actor: session.email };
    const patch: Record<string, unknown> = { status: to, updated_at: new Date(now).toISOString() };

    if (action === "assign" && parsed.data.action === "assign") {
      const check = await assertAssigneeInOrg(adminFindProfile(admin), session.orgId, parsed.data.assigned_to);
      if (!check.ok) return fail("NOT_FOUND", "Usuário fora da organização.", 404);
      patch["assigned_to"] = parsed.data.assigned_to;
      detail["assigned_to"] = parsed.data.assigned_to;
      await notifyUser(admin, session.orgId, {
        userId: parsed.data.assigned_to,
        kind: "os_atribuida",
        title: `OS designada para você`,
        body: "Verifique documentos e fotos antes de iniciar.",
        link: `/os/${id}`,
      });
    }
    if (action === "start" && !wo.started_at) patch["started_at"] = new Date(now).toISOString();

    if (action === "pause" && parsed.data.action === "pause") {
      // Congela o SLA: desconta o ativo desde o ultimo inicio e grava antes/depois.
      const { data: lastPause } = await admin
        .from("work_order_pauses")
        .select("resumed_at")
        .eq("work_order_id", id)
        .order("paused_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const activeStart = lastPause?.resumed_at
        ? Date.parse(lastPause.resumed_at as string)
        : wo.started_at
          ? Date.parse(wo.started_at as string)
          : now;
      const remaining = Math.max(0, (wo.sla_remaining_ms as number) - Math.max(0, now - activeStart));
      patch["sla_remaining_ms"] = remaining;
      const { error: pauseError } = await admin.from("work_order_pauses").insert({
        work_order_id: id,
        reason: parsed.data.reason,
        paused_at: new Date(now).toISOString(),
        sla_before_ms: wo.sla_remaining_ms,
        sla_after_ms: remaining,
        paused_by: session.userId,
      });
      if (pauseError) return fail("DB_UPDATE", "Nao foi possivel pausar.", 500);
      detail["reason"] = parsed.data.reason;
      detail["sla_before_ms"] = wo.sla_remaining_ms;
      detail["sla_after_ms"] = remaining;
      if (parsed.data.reason === "falta de componente") {
        await notifyRoles(admin, session.orgId, ["gestor", "admin"], {
          kind: "os_pausada_componente",
          title: "OS pausada por falta de componente",
          body: "Uma solicitação de compra vinculada pode ser necessária.",
          link: `/os/${id}`,
        }, session.userId);
      }
    }

    if (action === "resume") {
      const { data: openPause } = await admin
        .from("work_order_pauses")
        .select("id, paused_at, sla_after_ms")
        .eq("work_order_id", id)
        .is("resumed_at", null)
        .order("paused_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!openPause) return fail("INVALID_STATE", "Nenhuma pausa aberta.", 422);
      const duration = now - Date.parse(openPause.paused_at as string);
      await admin
        .from("work_order_pauses")
        .update({ resumed_at: new Date(now).toISOString(), duration_ms: duration, resumed_by: session.userId })
        .eq("id", openPause.id);
      detail["duration_ms"] = duration;
      detail["sla_remaining_ms"] = wo.sla_remaining_ms;
    }

    if (action === "complete") {
      // Foto obrigatória do checklist (Fase 08): item concluído com requires_photo precisa de foto vinculada.
      const { data: pending } = await admin
        .from("work_order_checklists")
        .select("id")
        .eq("work_order_id", id)
        .eq("done", true)
        .eq("requires_photo", true);
      if ((pending ?? []).length > 0) {
        const ids = (pending ?? []).map((p) => p.id);
        const { data: byOwner } = await admin
          .from("files")
          .select("owner_id")
          .eq("org_id", session.orgId)
          .eq("owner_type", "checklist_item")
          .in("owner_id", ids);
        const covered = new Set((byOwner ?? []).map((f) => f.owner_id));
        if (ids.some((pid) => !covered.has(pid))) {
          return fail("PHOTO_REQUIRED", "Itens do checklist exigem foto antes de concluir.", 422);
        }
      }
      patch["finished_at"] = new Date(now).toISOString();
    }

    const { error: updateError } = await admin.from("work_orders").update(patch).eq("id", id);
    if (updateError) return fail("DB_UPDATE", "Nao foi possivel atualizar.", 500);
    await admin.from("work_order_events").insert({
      work_order_id: id,
      event: ACTION_EVENT[action],
      from_status: from,
      to_status: to,
      actor_profile_id: session.userId,
      detail,
      client_key: clientKey ?? null,
    });
    return ok({ id, from, to, sla_remaining_ms: patch["sla_remaining_ms"] ?? wo.sla_remaining_ms });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    if (e instanceof Error && e.message.startsWith("Transicao invalida")) {
      return fail("INVALID_TRANSITION", e.message, 422);
    }
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
