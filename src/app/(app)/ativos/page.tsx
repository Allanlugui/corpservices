"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface Asset {
  id: string;
  parent_id: string | null;
  tag: string;
  name: string;
  description: string;
  criticality: string;
}

const CRIT_TONE: Record<string, "blocked" | "warn" | "pending" | "ok"> = {
  critica: "blocked",
  alta: "warn",
  media: "pending",
  baixa: "ok",
};

export default function AtivosPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ tag: "", name: "", criticality: "media" });

  async function load(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q?.trim()) params.set("search", q.trim());
      const res = await fetch(`/api/ativos?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error) setError(json.error?.message ?? "Falha.");
      else setAssets(json.data.assets as Asset[]);
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/ativos").then(async (res) => {
      if (!alive) return;
      const json = await res.json();
      if (!alive) return;
      if (!res.ok || json.error) setError(json.error?.message ?? "Falha.");
      else setAssets(json.data.assets as Asset[]);
      setLoading(false);
    }).catch(() => {
      if (!alive) return;
      setError("Falha de rede.");
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function create() {
    if (form.tag.trim().length < 1 || form.name.trim().length < 2) {
      toast("TAG e nome são obrigatórios.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: form.tag.trim(), name: form.name.trim(), criticality: form.criticality }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Ativo cadastrado.");
        setForm({ tag: "", name: "", criticality: "media" });
        void load(search);
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && assets.length === 0) return <LoadingState label="Carregando ativos…" />;
  if (error) return <ErrorState title="Ativos indisponíveis" description={error} onRetry={() => void load(search)} />;

  return (
    <section>
      <PageHeader title="Ativos" description="Máquinas e equipamentos com TAG e criticidade (CMMS)." />
      <Card title="Novo ativo">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="TAG (ex: CMP-001)" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} />
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Compressor 01" />
          <Select label="Criticidade" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </Select>
        </div>
        <Button disabled={busy} onClick={() => void create()} className="mt-3">Cadastrar</Button>
      </Card>
      <Card title={`Cadastro (${assets.length})`} className="mt-4">
        <div className="mb-3 flex gap-2">
          <Input label="Buscar por TAG ou nome" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="secondary" disabled={busy} onClick={() => void load(search)} className="self-end">Buscar</Button>
        </div>
        <ul className="grid gap-2">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="font-mono font-bold">{a.tag}</span>
              <span className="flex-1">{a.name}</span>
              <Badge tone={CRIT_TONE[a.criticality] ?? "pending"}>{a.criticality}</Badge>
            </li>
          ))}
          {assets.length === 0 ? <li className="text-slate-500">Nenhum ativo. Cadastre o primeiro acima.</li> : null}
        </ul>
      </Card>
    </section>
  );
}
