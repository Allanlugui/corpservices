export type FindProfile = (userId: string) => Promise<{ id: string; org_id: string } | null>;

/**
 * P2: valida que o assignee pertence à organização da sessão.
 * Puro e testável; nunca confia no UUID enviado pelo cliente.
 * Null = remover atribuição (permitido).
 */
export async function assertAssigneeInOrg(
  findProfile: FindProfile,
  orgId: string,
  assignedTo: string | null,
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" }> {
  if (assignedTo === null) return { ok: true };
  const profile = await findProfile(assignedTo);
  if (!profile || profile.org_id !== orgId) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true };
}
