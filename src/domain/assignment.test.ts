import { describe, expect, it } from "vitest";
import { assertAssigneeInOrg } from "./assignment";

const ORG = "org-1";

describe("assertAssigneeInOrg", () => {
  it("aceita usuário válido da organização", async () => {
    const r = await assertAssigneeInOrg(async () => ({ id: "u1", org_id: ORG }), ORG, "u1");
    expect(r).toEqual({ ok: true });
  });

  it("rejeita usuário de outra organização", async () => {
    const r = await assertAssigneeInOrg(async () => ({ id: "u2", org_id: "org-2" }), ORG, "u2");
    expect(r).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("rejeita UUID inexistente", async () => {
    const r = await assertAssigneeInOrg(async () => null, ORG, "nope");
    expect(r).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("permite remover atribuição (null)", async () => {
    const r = await assertAssigneeInOrg(async () => null, ORG, null);
    expect(r).toEqual({ ok: true });
  });

  it("não autoriza por role aqui (só pertinência); permissão é checada na rota", async () => {
    const r = await assertAssigneeInOrg(async () => ({ id: "u3", org_id: ORG }), ORG, "u3");
    expect(r.ok).toBe(true);
  });
});
