"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";

interface Supplier {
  id: string;
  name: string;
  doc?: string | null;
  contact?: string | null;
}

export default function FornecedoresPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ name: "", doc: "", contact: "" });
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/fornecedores")
      .then(async (r) => {
        const j = await r.json();
        if (!j.error) setRows(j.data.suppliers);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    const res = await fetch("/api/fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível criar.", "error");
    else {
      toast("Fornecedor criado.");
      setForm({ name: "", doc: "", contact: "" });
      load();
    }
  }

  async function saveEdit() {
    if (!editing || !editing.name.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/fornecedores/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, doc: editing.doc ?? "", contact: editing.contact ?? "" }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível salvar.", "error");
      else {
        toast("Fornecedor atualizado.");
        setEditing(null);
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fornecedores/${deleting.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível excluir.", "error");
      else {
        toast("Fornecedor excluído.");
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <section>
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Fornecedores" }]} />
      <div className="mt-2">
        <PageHeader title="Fornecedores" description="Cadastro para cotações e entradas." />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cadastrados">
          <ul className="grid gap-2 text-sm">
            {rows.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-200 p-2">
                {editing?.id === s.id ? (
                  <div className="grid gap-2">
                    <Input label="Nome" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    <Input label="CNPJ/CPF" value={editing.doc ?? ""} onChange={(e) => setEditing({ ...editing, doc: e.target.value })} />
                    <Input label="Contato" value={editing.contact ?? ""} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void saveEdit()}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-slate-600">{[s.doc, s.contact].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(s)}>Excluir</Button>
                  </div>
                )}
              </li>
            ))}
            {rows.length === 0 ? <li className="text-slate-500">Nenhum fornecedor.</li> : null}
          </ul>
        </Card>
        <Card title="Novo fornecedor">
          <div className="grid gap-3">
            <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="CNPJ/CPF" value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} />
            <Input label="Contato" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <Button variant="secondary" onClick={() => void create()}>Criar</Button>
          </div>
        </Card>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/estoque" className="font-semibold text-brand-700 hover:underline">← Voltar para Estoque</Link>
      </p>
      {deleting ? (
        <ConfirmDialog
          title="Excluir fornecedor"
          description={`Excluir "${deleting.name}"? Fornecedores vinculados a produtos são protegidos.`}
          confirmLabel="Excluir"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </section>
  );
}
