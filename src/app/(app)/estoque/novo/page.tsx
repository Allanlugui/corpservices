"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";

export default function NovoProdutoPage() {
  const router = useRouter();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", unit: "un", category: "", supplier_id: "",
    location: "", stock_min: "0", stock_max: "0", cost: "0",
    sku: "", internal_code: "", barcode: "", manufacturer: "", notes: "",
  });
  const [xml, setXml] = useState("");
  const [xmlResult, setXmlResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fornecedores")
      .then(async (r) => {
        const j = await r.json();
        if (!j.error) setSuppliers(j.data.suppliers);
      })
      .catch(() => {});
  }, []);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          supplier_id: form.supplier_id || undefined,
          category: form.category || undefined,
          stock_min: Number(form.stock_min) || 0,
          stock_max: Number(form.stock_max) || 0,
          cost_cents: Math.round(Number(form.cost.replace(",", ".")) * 100) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível criar.", "error");
      else {
        if (json.data.cadastro_incompleto) toast(`Criado com pendências: ${json.data.pendencias.join(", ")}.`, "error");
        else toast("Produto criado.");
        router.push(`/estoque/${json.data.id}`);
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function importXml() {
    if (xml.trim().length < 50) {
      toast("Cole o XML da NF-e.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/estoque/entrada-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });
      const json = await res.json();
      if (!res.ok || json.error) setXmlResult(`Erro: ${json.error?.message}`);
      else {
        const lines = json.data.items.map((i: { name: string; quantity: number; cadastro_incompleto: boolean }) =>
          `• ${i.name} x${i.quantity}${i.cadastro_incompleto ? " (incompleto)" : ""}`);
        setXmlResult(`Emitente: ${json.data.issuer}\n${lines.join("\n")}`);
        toast("XML importado.");
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: "Novo" }]} />
      <div className="mt-2">
        <PageHeader title="Novo produto" description="Campos opcionais ausentes geram pendência, nunca bloqueio." />
      </div>
      <Card title="Cadastro manual">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Nome *" value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
          <Input label="Unidade" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
          <Input label="Categoria" value={form.category} onChange={(e) => set("category", e.target.value)} />
          <Select label="Fornecedor" value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Localização" value={form.location} onChange={(e) => set("location", e.target.value)} />
          <Input label="Estoque mínimo" value={form.stock_min} onChange={(e) => set("stock_min", e.target.value)} inputMode="numeric" />
          <Input label="Estoque máximo" value={form.stock_max} onChange={(e) => set("stock_max", e.target.value)} inputMode="numeric" />
          <Input label="Custo (R$)" value={form.cost} onChange={(e) => set("cost", e.target.value)} inputMode="decimal" />
          <Input label="SKU" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          <Input label="Código interno" value={form.internal_code} onChange={(e) => set("internal_code", e.target.value)} />
          <Input label="Código de barras" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
          <Input label="Fabricante" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          <div className="sm:col-span-2"><Textarea label="Observações" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="w-full sm:w-auto">Criar produto</Button></div>
        </form>
      </Card>
      <Card title="Entrada via XML de NF-e" className="mt-4">
        <Textarea label="Cole o XML" value={xml} onChange={(e) => setXml(e.target.value)} rows={4} hint="Itens sem dados opcionais entram como cadastro incompleto." />
        <Button variant="secondary" onClick={() => void importXml()} disabled={busy} className="mt-2">Importar XML</Button>
        {xmlResult ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{xmlResult}</pre> : null}
      </Card>
      <p className="mt-4 text-sm">
        <Link href="/estoque" className="font-semibold text-brand-700 hover:underline">← Voltar para Estoque</Link>
      </p>
    </section>
  );
}
