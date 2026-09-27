import { describe, expect, it } from "vitest";
import { businessContentHash, chainHashV1, chainHashV2, stableJson, verifyBusiness, verifyChain, type ChainRow } from "./audit-chain";

function row(partial: Partial<ChainRow>): ChainRow {
  return {
    id: "a", org_id: "o", event: "LOGIN", detail: { email: "x@y" },
    created_at: "2026-09-27T00:00:00.000Z", previous_hash: "", hash: "", hash_version: 2,
    ...partial,
  };
}

describe("audit-chain (D-09)", () => {
  it("stableJson ordena chaves", () => {
    expect(stableJson({ b: 1, a: 2 })).toBe(stableJson({ a: 2, b: 1 }));
  });

  it("cadeia v2 íntegra verifica OK", () => {
    const r1 = row({ id: "a" });
    r1.hash = chainHashV2("", "o", "LOGIN", r1.detail, r1.created_at);
    const r2 = row({ id: "b", previous_hash: r1.hash });
    r2.hash = chainHashV2(r1.hash, "o", "LOGIN", r2.detail, r2.created_at);
    expect(verifyChain([r2, r1]).ok).toBe(true);
  });

  it("detecta adulteração de conteúdo", () => {
    const r1 = row({ id: "a" });
    r1.hash = chainHashV2("", "o", "LOGIN", r1.detail, r1.created_at);
    const tampered = { ...r1, detail: { email: "evil@z" } };
    expect(verifyChain([tampered]).ok).toBe(false);
    expect(verifyChain([tampered]).break_at).toBe("a");
  });

  it("detecta quebra de elo (remoção)", () => {
    const r1 = row({ id: "a" });
    r1.hash = chainHashV2("", "o", "LOGIN", r1.detail, r1.created_at);
    const r2 = row({ id: "b", previous_hash: "outro" });
    r2.hash = chainHashV2("outro", "o", "LOGIN", r2.detail, r2.created_at);
    expect(verifyChain([r1, r2]).ok).toBe(false);
  });

  it("linhas v1 (backfill) verificam pelo elo", () => {
    const r1 = row({ id: "a", hash_version: 1, event: "X", detail: {} });
    r1.hash = chainHashV1("", "a");
    expect(verifyChain([r1]).ok).toBe(true);
  });
});

describe("verifyBusiness (Fase 29)", () => {
  const b = (over: Record<string, unknown>) => ({
    id: "e1",
    parent_id: "p1",
    event: "ALTERADO",
    from: "A",
    to: "B",
    actor_id: "u1",
    detail: {},
    created_at: "2026-09-27T00:00:00.000Z",
    previous_hash: "",
    hash: "",
    hash_version: 2,
    ...over,
  });

  it("cadeia por pai verifica OK", () => {
    const r1 = b({ id: "e1" });
    r1.hash = businessContentHash("", "p1", "ALTERADO", "A", "B", "u1", {}, r1.created_at);
    const r2 = b({ id: "e2", previous_hash: r1.hash, created_at: "2026-09-27T01:00:00.000Z" });
    r2.hash = businessContentHash(r1.hash, "p1", "ALTERADO", "A", "B", "u1", {}, r2.created_at);
    expect(verifyBusiness([r2, r1]).ok).toBe(true);
  });

  it("detecta adulteração em evento de negócio", () => {
    const r1 = b({ id: "e1" });
    r1.hash = businessContentHash("", "p1", "ALTERADO", "A", "B", "u1", {}, r1.created_at);
    const tampered = { ...r1, to: "C" };
    expect(verifyBusiness([tampered]).ok).toBe(false);
  });
});
