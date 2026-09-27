"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EMPTY_FORM, ProductForm, toPayload, type ProductFormValue } from "@/components/ProductForm";

export default function NovoProdutoPage() {
  const router = useRouter();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProductFormValue>(EMPTY_FORM);
  const [xmlResult, setXmlResult] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [source, setSource] = useState<"xml" | "pdf">("xml");
  const [preview, setPreview] = useState<null | {
    issuer: string;
    supplier_id: string | null;
    supplier_created: boolean;
    items: {
      index: number; name: string; quantity: number; unit: string;
      cost_cents: number; barcode: string | null; missing: string[];
      matches: { product_id: string; name: string; quantity: number; supplier: string | null; by: string }[];
    }[];
  }>(null);
  const [review, setReview] = useState<Record<number, { name: string; quantity: string; use_existing: string }>>({});
  const [rawXml, setRawXml] = useState<string | null>(null);

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
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isXml = lower.endsWith(".xml");
    if (!isPdf && !isXml) {
      toast("Selecione .xml (NF-e) ou .pdf (DANFE).", "error");
      return;
    }
    setBusy(true);
    setPreview(null);
    setXmlResult(null);
    setWarnings([]);
    try {
      const endpoint = isPdf ? "/api/estoque/pdf-preview" : "/api/estoque/xml-preview";
      setSource(isPdf ? "pdf" : "xml");
      const payload = isPdf
        ? { pdf_base64: await fileToBase64(file) }
        : { xml: await file.text() };
      if (!isPdf) setRawXml((payload as { xml: string }).xml);
      else setRawXml(null);
      // M-01: prévia para revisão antes de lançar (XML NF-e, XML genérico ou DANFE).
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setXmlResult(`Erro: ${json.error?.message}`);
        return;
      }
      setPreview(json.data);
      setWarnings(json.data.warnings ?? []);
      const initial: Record<number, { name: string; quantity: string; use_existing: string }> = {};
      for (const item of json.data.items) {
        initial[item.index] = { name: item.name, quantity: String(item.quantity), use_existing: "" };
      }
      setReview(initial);
    } catch {
      toast("Falha ao ler o arquivo.", "error");
    } finally {
      setBusy(false);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  async function confirmAll() {
    if (!preview) return;
    const items = preview.items.map((item) => {
      const r = review[item.index] ?? { name: item.name, quantity: String(item.quantity), use_existing: "" };
      return {
        name: r.name.trim() || item.name,
        unit: item.unit,
        quantity: Number(r.quantity) || 0,
        cost_cents: item.cost_cents,
        barcode: item.barcode,
        supplier_id: preview.supplier_id,
        product_id: r.use_existing || null,
        issuer: preview.issuer,
      };
    });
    setBusy(true);
    try {
      const res = await fetch("/api/estoque/xml-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, xml: rawXml }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error?.message ?? "Não foi possível lançar.", "error");
        return;
      }
      const lines = json.data.items.map((i: { name: string; action: string; quantity: number }) =>
        `• ${i.name} x${i.quantity} (${i.action === "movimentado" ? "unificado ao cadastro" : "novo"})`);
      setXmlResult(`Lançados ${json.data.items.length} item(ns):\n${lines.join("\n")}`);
      setPreview(null);
      toast("Lançamento concluído.");
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
        <PageHeader title="Novo produto" description="Os mesmos campos da ficha. Opcionais ausentes geram pendência, nunca bloqueio." />
      </div>
      <Card title="Cadastro">
        <ProductForm value={form} onChange={setForm} suppliers={suppliers} submitLabel={busy ? "Criando…" : "Criar produto"} onSubmit={() => void submit()} busy={busy} />
      </Card>
      <Card title="Entrada via NF-e, XML ou PDF (DANFE)" className="mt-4">
        <label className="block text-sm font-medium">
          Arquivo .xml ou .pdf
          <input
            type="file"
            accept=".xml,.pdf,text/xml,application/pdf"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">
          XML de NF-e (completo, com XML auto-salvo) ou DANFE em PDF (extração best-effort).
          Extrai os itens para revisão: edite, resolva duplicatas e lance tudo de uma vez. A entrada-xml legada continua disponível na API.
        </p>
        {warnings.length > 0 ? (
          <ul className="mt-2 grid gap-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            {warnings.map((w, i) => <li key={i}>• {w}{source === "pdf" ? " (PDF: confira cada campo)" : ""}</li>)}
          </ul>
        ) : null}
        {preview ? (
          <div className="mt-3 grid gap-3">
            <p className="text-sm">
              Fornecedor: <strong>{preview.issuer}</strong>
              {preview.supplier_created ? " (será cadastrado)" : ""}
            </p>
            {preview.items.map((item) => {
              const r = review[item.index] ?? { name: item.name, quantity: String(item.quantity), use_existing: "" };
              const setR = (patch: Partial<typeof r>) => setReview((prev) => ({ ...prev, [item.index]: { ...r, ...patch } }));
              return (
                <div key={item.index} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-sm font-medium">Nome
                      <input value={r.name} onChange={(e) => setR({ name: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="block text-sm font-medium">Quantidade
                      <input value={r.quantity} onChange={(e) => setR({ quantity: e.target.value })} inputMode="decimal" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                  </div>
                  {item.missing.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-800">Faltando: {item.missing.join(", ")} (entra como incompleto).</p>
                  ) : null}
                  {item.matches.length > 0 ? (
                    <label className="mt-2 block text-sm font-medium text-brand-900">
                      Possível duplicata — é o mesmo produto?
                      <select value={r.use_existing} onChange={(e) => setR({ use_existing: e.target.value })} className="mt-1 block w-full rounded-lg border border-brand-600 bg-brand-50 px-3 py-2 text-sm">
                        <option value="">Não — criar novo</option>
                        {item.matches.map((m) => (
                          <option key={m.product_id} value={m.product_id}>Sim — unificar a “{m.name}” (saldo {m.quantity}{m.supplier ? `, ${m.supplier}` : ""})</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    Destino: {r.use_existing
                      ? `unificar a “${item.matches.find((m) => m.product_id === r.use_existing)?.name ?? "produto existente"}” (NÃO cria novo)`
                      : "criar produto NOVO"}
                  </p>
                </div>
              );
            })}
            <Button onClick={() => void confirmAll()} disabled={busy}>
              {busy ? "Lançando…" : `Revisado — lançar ${preview.items.length} item(ns)`}
            </Button>
          </div>
        ) : null}
        {xmlResult ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{xmlResult}</pre> : null}
      </Card>
      <p className="mt-4 text-sm">
        <Link href="/estoque" className="font-semibold text-brand-700 hover:underline">← Voltar para Estoque</Link>
      </p>
    </section>
  );
}
