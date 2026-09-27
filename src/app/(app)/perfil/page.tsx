"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export default function PerfilPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<{ email: string; display_name: string | null; avatar_url: string; department: string; position: string; phone: string; role_key: string } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  async function load() {
    const res = await fetch("/api/perfil");
    if (res.ok) {
      const p = (await res.json()).data.profile;
      setProfile(p);
      setName(p.display_name ?? "");
    }
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/perfil").then(async (res) => {
      if (!res.ok || !alive) return;
      const p = (await res.json()).data.profile;
      if (!alive) return;
      setProfile(p);
      setName(p.display_name ?? "");
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function saveName() {
    if (name.trim().length < 2) {
      toast("Nome muito curto.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/perfil", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name.trim() }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Nome atualizado.");
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_048_576) {
      toast("Use PNG, JPG ou WEBP de até 1 MB.", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/perfil", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Foto atualizada.");
        void load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function changePw() {
    if (pw.next.length < 8) {
      toast("Nova senha: mínimo 8 caracteres.", "error");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast("Confirmação diferente.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/perfil/senha", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: pw.current, next: pw.next }) });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Falha.", "error");
      else {
        toast("Senha trocada.");
        setPw({ current: "", next: "", confirm: "" });
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <LoadingState label="Carregando perfil…" />;
  return (
    <section className="mx-auto max-w-xl">
      <PageHeader title="Meu perfil" description="Nome, foto e senha." />
      <Card title="Identificação">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Foto" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" />
          ) : (
            <span aria-hidden className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white">
              {(profile.display_name ?? profile.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-semibold">{profile.display_name ?? profile.email}</p>
            <p className="text-sm text-slate-500">{profile.email} · {profile.role_key}</p>
            {[profile.department, profile.position].filter(Boolean).join(" · ") ? (
              <p className="text-sm text-slate-500">{[profile.department, profile.position].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Nome de exibição" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-sm font-medium">Foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
            />
          </label>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void saveName()} className="mt-3">Salvar nome</Button>
      </Card>
      <Card title="Trocar senha" className="mt-4">
        <div className="grid gap-3">
          <Input label="Senha atual" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <Input label="Nova senha (mín. 8)" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          <Input label="Confirmar nova" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void changePw()} className="mt-3">Trocar senha</Button>
      </Card>
    </section>
  );
}
