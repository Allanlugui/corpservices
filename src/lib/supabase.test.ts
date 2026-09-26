import { describe, expect, it } from "vitest";
import { SupabaseNotConfiguredError, getSupabaseConfig } from "./supabase";

describe("getSupabaseConfig", () => {
  it("falha fechado sem credenciais", () => {
    expect(() => getSupabaseConfig({})).toThrow(SupabaseNotConfiguredError);
  });

  it("aceita variaveis server-only ou publicas", () => {
    expect(getSupabaseConfig({ SUPABASE_URL: "u", SUPABASE_ANON_KEY: "k" })).toEqual({
      url: "u",
      anonKey: "k",
    });
    expect(
      getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }),
    ).toEqual({ url: "u", anonKey: "k" });
  });
});
