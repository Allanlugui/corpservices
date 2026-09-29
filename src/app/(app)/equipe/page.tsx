"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { MODULES, ROLES, can, type Action } from "@/domain/rbac";

const ACTIONS: Action[] = ["read", "create", "update", "delete", "approve", "execute", "manage"];

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  role_key: string;
  department: string;
  position: string;
  phone: string;
  banned: boolean;
  must_reset: boolean;
  permissions: { module: string; action: string; allowed: boolean }[];
}

export default function EquipePage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState({ email: "", display_name: "", role_key: "tecnico", department: "", position: "", phone: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ display_name: "", role_key: "", department: "", position: "", phone: "" });
  const [perms, setPerms] = useState<Record<string, boolean | null>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/equipe");
      const json = await res.json();
      if (!res.ok || json.error) setError(json.error?.message ?? "Sem permissão (admin/gestor).");
      else setMembers(json.data.members as Member[]);
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/equipe").then(async (res) => {
      if (!alive) return;
      const json = await res.json();
      if (!alive) return;
      if (!res.ok || json.error) setError(json.error?.message ?? "Sem permissão (admin/gestor).");
      else setMembers(json.data.members as Member[]);
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

  function openEdit(m: Member) {
    setEditing(m.id);
    setForm({ display_name: m.display_name ?? "", role_key: m.role_key, department: m.department ?? "", position: m.position ?? "", phone: m.phone ?? "" });
    const p: Record<string, boolean | null> = {};
    for (const o of m.permissions) p[`${o.module}:${o.action}`] = o.allowed;
    setPerms(p);
  }

  async function sendInvite() {
    if (!invite.email.includes("@") || invite.display_name.trim().length < 2) {
      toast("E-mail e nome são obrigatórios.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/equipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invite) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Convite criado — ative o e-mail em Parâmetros e processe a fila em Configurações → E-mail.");
        setInvite({ email: "", display_name: "", role_key: "tecnico", department: "", position: "", phone: "" });
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    const permissions = Object.entries(perms)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => {
        const [module, action] = k.split(":");
        return { module, action, allowed: v as boolean };
      });
    setBusy(true);
    try {
      const res = await fetch(`/api/equipe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, permissions }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Membro atualizado.");
        setEditing(null);
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBan(m: Member) {
    setBusy(true);
    try {
      const res = m.banned
        ? await fetch(`/api/equipe/${m.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unban" }) })
        : await fetch(`/api/equipe/${m.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast(m.banned ? "Reativado." : "Desativado.");
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function forceReset(m: Member) {
    setBusy(true);
    try {
      const res = await fetch(`/api/equipe/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ must_reset: true }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else toast("No próximo login ele troca a senha.");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(m: Member) {
    setBusy(true);
    try {
      const res = await fetch(`/api/equipe/${m.id}/reset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else toast("Link de restauração enviado por e-mail (vale 2h).");
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Carregando equipe…" />;
  if (error) return <ErrorState title="Equipe indisponível" description={error} onRetry={() => void load()} />;

  const cycle = (key: string, roleKey: string, mod: string, act: string) => {
    const cur = perms[key] ?? null;
    // herdado → força o oposto do papel → herdado
    const base = can(roleKey as (typeof ROLES)[number], mod as (typeof MODULES)[number], act as Action);
    setPerms((p) => ({ ...p, [key]: cur === null ? !base : null }));
  };

  return (
    <section>
      <PageHeader title="Equipe" description="Quem acessa, com qual papel e permissões extras. Convite envia senha provisória por e-mail." />
      <Card title="Convidar">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="E-mail corporativo" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} inputMode="email" />
          <Input label="Nome" value={invite.display_name} onChange={(e) => setInvite({ ...invite, display_name: e.target.value })} />
          <label className="block text-sm font-medium">Papel
            <select value={invite.role_key} onChange={(e) => setInvite({ ...invite, role_key: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <Input label="Setor" value={invite.department} onChange={(e) => setInvite({ ...invite, department: e.target.value })} />
          <Input label="Cargo" value={invite.position} onChange={(e) => setInvite({ ...invite, position: e.target.value })} />
          <Input label="WhatsApp" value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} inputMode="tel" />
        </div>
        <Button disabled={busy} onClick={() => void sendInvite()} className="mt-3">Enviar convite</Button>
      </Card>
      <div className="mt-4 grid gap-3">
        {members.map((m) => (
          <Card
            key={m.id}
            title={`${m.display_name ?? m.email}`}
            actions={<span className="flex gap-1">{m.banned ? <Badge tone="blocked">INATIVO</Badge> : <Badge tone="ok">{m.role_key}</Badge>}{m.must_reset ? <Badge tone="pending">TROCA SENHA</Badge> : null}</span>}
          >
            <p className="text-sm text-slate-600">{m.email}{[m.department, m.position].filter(Boolean).length > 0 ? ` · ${[m.department, m.position].filter(Boolean).join(" · ")}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => (editing === m.id ? setEditing(null) : openEdit(m))}>
                {editing === m.id ? "Fechar" : "Editar"}
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void forceReset(m)}>Exigir troca de senha</Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void sendReset(m)}>Enviar reset por e-mail</Button>
              <Button variant={m.banned ? "secondary" : "danger"} size="sm" disabled={busy} onClick={() => void toggleBan(m)}>
                {m.banned ? "Reativar" : "Desativar"}
              </Button>
            </div>
            {editing === m.id ? (
              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Nome" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                <label className="block text-sm font-medium">Papel
                  <select value={form.role_key} onChange={(e) => setForm({ ...form, role_key: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <Input label="Setor" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                <Input label="Cargo" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                <Input label="WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-sm font-semibold">Permissões extras (clique para forçar o oposto do papel; de novo volta a herdar)</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr>
                          <th className="text-left">Módulo</th>
                          {ACTIONS.map((a) => <th key={a} className="px-1">{a}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((mod) => (
                          <tr key={mod} className="border-t border-slate-100">
                            <td className="py-1 pr-2 font-medium">{mod}</td>
                            {ACTIONS.map((act) => {
                              const key = `${mod}:${act}`;
                              const v = perms[key] ?? null;
                              const base = can(form.role_key as (typeof ROLES)[number], mod, act);
                              return (
                                <td key={act} className="px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => cycle(key, form.role_key, mod, act)}
                                    title={v === null ? `Herdado: ${base ? "permitido" : "negado"}` : v ? "Permitido (clique p/ negar)" : "Negado (clique p/ herdar)"}
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded font-bold ${v === true ? "bg-emerald-600 text-white" : v === false ? "bg-red-700 text-white" : base ? "bg-slate-200 text-slate-500" : "bg-white text-slate-300 ring-1 ring-slate-200"}`}
                                  >
                                    {v === null ? (base ? "·" : "–") : v ? "+" : "×"}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button disabled={busy} onClick={() => void save(m.id)}>Salvar alterações</Button>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  );
}
