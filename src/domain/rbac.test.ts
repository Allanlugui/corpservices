import { describe, expect, it } from "vitest";
import { can, parseRole } from "./rbac";

describe("RBAC", () => {
  it("admin pode tudo", () => {
    expect(can("admin", "purchases", "approve")).toBe(true);
    expect(can("admin", "settings", "delete")).toBe(true);
  });

  it("tecnico executa OS mas nao aprova compra nem gerencia estoque", () => {
    expect(can("tecnico", "work_orders", "execute")).toBe(true);
    expect(can("tecnico", "purchases", "approve")).toBe(false);
    expect(can("tecnico", "inventory", "update")).toBe(false);
  });

  it("solicitante cria ticket mas nao le auditoria", () => {
    expect(can("solicitante", "tickets", "create")).toBe(true);
    expect(can("solicitante", "audit", "read")).toBe(false);
  });

  it("auditor so le", () => {
    expect(can("auditor", "audit", "read")).toBe(true);
    expect(can("auditor", "purchases", "approve")).toBe(false);
  });

  it("parseRole rejeita valores desconhecidos (fail-closed)", () => {
    expect(parseRole("superadmin")).toBeNull();
    expect(parseRole(null)).toBeNull();
    expect(parseRole("gestor")).toBe("gestor");
  });
});
