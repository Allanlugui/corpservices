"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { EMPTY_FORM, ProductForm, toPayload, type ProductFormValue } from "@/components/ProductForm";

export default function NovoProdutoPage() {
  const router = useRouter();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProductFormValue>(EMPTY_FORM);
  const [xmlResult, setXmlResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fornecedores")
      .then(async (r) => {
        const j = await r.json();
        if (!j.error) setSuppliers(j.data.suppliers);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
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

  async function importFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast("Selecione um arquivo .xml de NF-e.", "error");
      return;
    }
    setBusy(true);
    try {
      const xml = await file.text();
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
        setXmlResult(`Arquivo: ${file.name}\nFornecedor: ${json.data.supplier ?? json.data.issuer}${json.data.supplier_created ? " (cadastrado agora)" : ""}\n${lines.join("\n")}`);
        toast(`${json.data.items.length} item(ns) lançado(s).`);
      }
    } catch {
      toast("Falha ao ler o arquivo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: "Novo" }]} />
      <div className="mt-2">
        <PageHeader title="Novo produto" description="Os mesmos campos da ficha. Opcionais ausentes geram pendência, nunca bloqueio." />
      </div>
      <Card title="Cadastro">
        <ProductForm value={form} onChange={setForm} suppliers={suppliers} submitLabel={busy ? "Criando…" : "Criar produto"} onSubmit={() => void submit()} busy={busy} />
      </Card>
      <Card title="Entrada via arquivo XML de NF-e" className="mt-4">
        <label className="block text-sm font-medium">
          Arquivo .xml
          <input
            type="file"
            accept=".xml,text/xml"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">Todos os itens da nota entram de uma vez; fornecedor é cadastrado automaticamente.</p>
        {xmlResult ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{xmlResult}</pre> : null}
      </Card>
      <p className="mt-4 text-sm">
        <Link href="/estoque" className="font-semibold text-brand-700 hover:underline">← Voltar para Estoque</Link>
      </p>
    </section>
  );
}
