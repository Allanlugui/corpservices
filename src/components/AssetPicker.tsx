"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Vincula ativo (TAG) à OS no planejamento. */
export function AssetPicker({
  osId,
  current,
  onChanged,
}: {
  osId: string;
  current: { id: string; tag: string; name: string } | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<{ id: string; tag: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) {
      setOpts([]);
      return;
    }
    try {
      const res = await fetch(`/api/ativos?search=${encodeURIComponent(v.trim())}`);
      const json = await res.json();
      if (res.ok && !json.error) setOpts(json.data.assets as { id: string; tag: string; name: string }[]);
    } catch {
      /* busca silenciosa */
    }
  }

  async function pick(assetId: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/os/${osId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "asset", asset_id: assetId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast(assetId ? "Ativo vinculado." : "Ativo removido.");
        setOpts([]);
        setQ("");
        onChanged();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 border-t border-slate-100 pt-2">
      <p className="text-sm font-medium">
        Ativo: {current ? <strong>{current.tag} · {current.name}</strong> : "não vinculado"}
      </p>
      <input
        value={q}
        onChange={(e) => void search(e.target.value)}
        placeholder="Buscar TAG ou nome…"
        aria-label="Buscar ativo"
        autoComplete="off"
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {opts.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {opts.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy}
              onClick={() => void pick(a.id)}
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
            >
              {a.tag} · {a.name}
            </button>
          ))}
        </div>
      ) : null}
      {current ? (
        <div>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void pick(null)}>Desvincular</Button>
        </div>
      ) : null}
    </div>
  );
}
