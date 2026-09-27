import { describe, expect, it } from "vitest";
import { can, canWithOverlay, parseRole } from "./rbac";

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

  it("tecnico pode enviar foto mas nao excluir; gestor exclui", () => {
    expect(can("tecnico", "files", "create")).toBe(true);
    expect(can("tecnico", "files", "delete")).toBe(false);
    expect(can("gestor", "files", "delete")).toBe(true);
  });

  it("parseRole rejeita valores desconhecidos (fail-closed)", () => {
    expect(parseRole("superadmin")).toBeNull();
    expect(parseRole(null)).toBeNull();
    expect(parseRole("gestor")).toBe("gestor");
  });

  it("overlay vazio = papel (compatível)", () => {
    expect(canWithOverlay("tecnico", "purchases", "approve", [])).toBe(false);
    expect(canWithOverlay("tecnico", "work_orders", "execute", [])).toBe(true);
  });

  it("deny explícito vence o papel", () => {
    expect(canWithOverlay("gestor", "purchases", "approve", [{ module: "purchases", action: "approve", allowed: false }])).toBe(false);
    expect(canWithOverlay("admin", "purchases", "approve", [{ module: "purchases", action: "approve", allowed: false }])).toBe(false);
  });

  it("allow explícito concede além do papel", () => {
    expect(canWithOverlay("tecnico", "purchases", "approve", [{ module: "purchases", action: "approve", allowed: true }])).toBe(true);
  });

  it("overlay de outro módulo não afeta", () => {
    expect(canWithOverlay("tecnico", "purchases", "approve", [{ module: "inventory", action: "update", allowed: true }])).toBe(false);
  });
});
