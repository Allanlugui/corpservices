"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

interface Loc {
  id: string;
  parent_id: string | null;
  name: string;
  active: boolean;
}

/** Estrutura física em árvore (prédio › andar › sala). */
export function Locais() {
  const toast = useToast();
  const [locs, setLocs] = useState<Loc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");

  async function load() {
    const res = await fetch("/api/locais");
    if (res.ok) {
      setLocs((await res.json()).data.locations as Loc[]);
      setLoaded(true);
    }
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/locais").then(async (res) => {
      if (!res.ok || !alive) return;
      setLocs((await res.json()).data.locations as Loc[]);
      if (alive) setLoaded(true);
    }).catch(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pathOf = (l: Loc): string => {
    const chain: string[] = [l.name];
    let p = locs.find((x) => x.id === l.parent_id);
    let guard = 0;
    while (p && guard++ < 10) {
      chain.unshift(p.name);
      p = locs.find((x) => x.id === p?.parent_id);
    }
    return chain.join(" › ");
  };

  async function create() {
    if (name.trim().length < 2) {
      toast("Nome muito curto.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/locais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parent_id: parent || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Local criado.");
        setName("");
        setParent("");
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(l: Loc) {
    setBusy(true);
    try {
      const res = await fetch(`/api/locais/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !l.active }),
      });
      if (!res.ok) toast("Falha.", "error");
      else void load();
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este local? Filhos e vínculos impedem.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/locais/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Excluído.");
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <LoadingState label="Carregando locais…" />;
  return (
    <div className="grid gap-3">
      <Card title="Novo local">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome (ex: Sala 205)" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-sm font-medium">Dentro de (opcional)
            <select value={parent} onChange={(e) => setParent(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Nível raiz (prédio/bloco)</option>
              {locs.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{pathOf(l)}</option>)}
            </select>
          </label>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void create()} className="mt-3">Adicionar</Button>
      </Card>
      <Card title={`Estrutura (${locs.length})`}>
        {locs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum local. Cadastre prédios, andares e salas — o solicitante escolhe na abertura.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {[...locs].sort((a, b) => pathOf(a).localeCompare(pathOf(b))).map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex-1">{pathOf(l)} {!l.active ? <Badge tone="blocked">INATIVO</Badge> : null}</span>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void toggle(l)}>{l.active ? "Desativar" : "Ativar"}</Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove(l.id)}>Excluir</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
