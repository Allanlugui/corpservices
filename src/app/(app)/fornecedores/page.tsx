"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";

export default function FornecedoresPage() {
  const toast = useToast();
  const [rows, setRows] = useState<{ id: string; name: string; doc?: string; contact?: string }[]>([]);
  const [form, setForm] = useState({ name: "", doc: "", contact: "" });

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
                <p className="font-semibold">{s.name}</p>
                <p className="text-slate-600">{[s.doc, s.contact].filter(Boolean).join(" · ") || "—"}</p>
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
    </section>
  );
}
