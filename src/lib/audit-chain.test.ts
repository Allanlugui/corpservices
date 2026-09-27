import { describe, expect, it } from "vitest";
import { chainHashV1, chainHashV2, stableJson, verifyChain, type ChainRow } from "./audit-chain";

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
