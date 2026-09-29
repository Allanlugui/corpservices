"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/extra";
import { useToast } from "@/components/ui/toast";

interface RoleEntry {
  role: string;
  fields: { key: string; label: string; type: "bool" | "number"; min?: number; max?: number; def: number | boolean; help: string }[];
  values: Record<string, number | boolean>;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  solicitante: "Solicitante",
  comprador: "Comprador",
  tecnico: "Técnico",
  estoque: "Estoque",
  auditor: "Auditor",
};

/** Configurações por tipo de usuário, editadas pelo gestor. */
export function RoleConfig() {
  const toast = useToast();
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/configuracoes/papeis");
    if (!res.ok) {
      setError("Sem permissão (admin/gestor).");
      setLoaded(true);
      return;
    }
    setRoles((await res.json()).data.roles as RoleEntry[]);
    setLoaded(true);
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/configuracoes/papeis").then(async (res) => {
      if (!alive) return;
      if (!res.ok) setError("Sem permissão (admin/gestor).");
      else setRoles((await res.json()).data.roles as RoleEntry[]);
      if (alive) setLoaded(true);
    }).catch(() => {
      if (alive) {
        setError("Falha de rede.");
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save(role: string, key: string, value: number | boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/configuracoes/papeis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key, value }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Configuração salva (com auditoria).");
        setRoles((prev) => prev.map((r) => (r.role === role ? { ...r, values: { ...r.values, [key]: value } } : r)));
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <LoadingState label="Carregando perfis…" />;
  if (error) return <ErrorState title="Indisponível" description={error} onRetry={() => void load()} />;
  return (
    <div className="grid gap-3">
      {roles.filter((r) => r.fields.length > 0).map((r) => (
        <Card key={r.role} title={ROLE_LABEL[r.role] ?? r.role}>
          {r.fields.map((f) => (
            <div key={f.key} className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-2 first:border-0 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-slate-500">{f.help}</p>
              </div>
              {f.type === "bool" ? (
                <Switch checked={r.values[f.key] === true} disabled={busy} label={f.label} onChange={(v) => void save(r.role, f.key, v)} />
              ) : (
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    defaultValue={Number(r.values[f.key] ?? f.def)}
                    id={`rc-${r.role}-${f.key}`}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const el = document.getElementById(`rc-${r.role}-${f.key}`) as HTMLInputElement | null;
                      const v = Number(el?.value);
                      if (!Number.isFinite(v)) {
                        toast("Valor inválido.", "error");
                        return;
                      }
                      void save(r.role, f.key, v);
                    }}
                  >
                    Salvar
                  </Button>
                </span>
              )}
            </div>
          ))}
        </Card>
      ))}
      <p className="text-xs text-slate-500">Perfis sem campos configuráveis usam só o papel + permissões extras da Equipe.</p>
    </div>
  );
}
