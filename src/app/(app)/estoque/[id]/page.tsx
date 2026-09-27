"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionLink } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { EMPTY_FORM, ProductForm, toPayload, type ProductFormValue } from "@/components/ProductForm";

interface Detail {
  product: {
    id: string; name: string; description: string; unit: string; location: string | null;
    stock_min: number; stock_max: number; quantity: number; cost_cents: number;
    sku: string | null; internal_code: string | null; barcode: string | null;
    manufacturer: string | null; warranty_months: number | null; support_months: number | null;
    ncm: string | null; weight_kg: number | null;
    category_id: string | null; supplier_id: string | null;
    product_categories: { name: string } | null; suppliers: { name: string } | null;
    notes: string; cadastro_incompleto: boolean; created_at: string;
  };
  batches: { id: string; batch: string | null; expires_at: string | null; quantity: number }[];
  movements: { id: string; kind: string; quantity: number; reason: string; actor_name: string; created_at: string }[];
}

function EditForm({
  initial,
  suppliers,
  saving,
  onSave,
}: {
  initial: ProductFormValue;
  suppliers: { id: string; name: string }[];
  saving: boolean;
  onSave: (v: ProductFormValue) => void;
}) {
  const [value, setValue] = useState<ProductFormValue>(initial);
  return (
    <ProductForm
      value={value}
      onChange={setValue}
      suppliers={suppliers}
      submitLabel={saving ? "Salvando…" : "Salvar alterações"}
      onSubmit={() => onSave(value)}
      busy={saving}
    />
  );
}

function DetailInner({ id }: { id: string }) {
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mov, setMov] = useState({ kind: "entrada", quantity: "1", reason: "", batch: "", expires_at: "" });
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/estoque/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else setDetail(json.data as Detail);
      })
      .catch(() => setError("Falha de rede."));
  }

  useEffect(() => {
    load();
    fetch("/api/fornecedores")
      .then(async (r) => {
        const j = await r.json();
        if (!j.error) setSuppliers(j.data.suppliers);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move() {
    if (!mov.reason.trim()) {
      toast("Informe o motivo.", "error");
      return;
    }
    const res = await fetch(`/api/estoque/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: mov.kind,
        quantity: Number(mov.quantity) || 0,
        reason: mov.reason.trim(),
        batch: mov.batch || undefined,
        expires_at: mov.expires_at || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível movimentar.", "error");
    else {
      toast(`Saldo atual: ${json.data.quantity}.`);
      setMov({ kind: "entrada", quantity: "1", reason: "", batch: "", expires_at: "" });
      load();
    }
  }

  if (error && !detail) return <ErrorState title="Produto indisponível" description={error} onRetry={() => window.location.reload()} />;
  if (!detail) return <LoadingState label="Carregando produto…" />;
  const { product: p, batches, movements } = detail;

  const formValue: ProductFormValue = {
    ...EMPTY_FORM,
    name: p.name,
    description: p.description,
    unit: p.unit,
    category: p.product_categories?.name ?? "",
    supplier_id: p.supplier_id ?? "",
    location: p.location ?? "",
    stock_min: String(p.stock_min),
    stock_max: String(p.stock_max),
    cost: p.cost_cents ? String(p.cost_cents / 100).replace(".", ",") : "",
    sku: p.sku ?? "",
    internal_code: p.internal_code ?? "",
    barcode: p.barcode ?? "",
    manufacturer: p.manufacturer ?? "",
    warranty_months: p.warranty_months !== null ? String(p.warranty_months) : "",
    support_months: p.support_months !== null ? String(p.support_months) : "",
    ncm: p.ncm ?? "",
    weight_kg: p.weight_kg !== null ? String(p.weight_kg) : "",
    notes: p.notes,
  };

  async function saveEdit(v: ProductFormValue) {
    setSaving(true);
    try {
      const res = await fetch(`/api/estoque/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(v)),
      });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Não foi possível salvar.", "error");
      else {
        toast("Produto atualizado (pendências recalculadas).");
        load();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: p.name }]} />
      <div className="mt-2">
        <PageHeader
          title={p.name}
          description={`${p.quantity} ${p.unit} em saldo${p.location ? ` · ${p.location}` : ""}`}
          actions={<>{p.cadastro_incompleto ? <Badge tone="pending">CADASTRO INCOMPLETO</Badge> : null} <ActionLink href={`/api/pdf?entity=produto&id=${p.id}`}>Baixar PDF</ActionLink></>}
        />
      </div>
      <Tabs
        tabs={[
          {
            id: "resumo",
            label: "Resumo",
            content: (
              <Card title="Ficha do produto">
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div><dt className="text-slate-500">Unidade</dt><dd className="font-medium">{p.unit}</dd></div>
                  <div><dt className="text-slate-500">Mín / Máx</dt><dd className="font-medium">{p.stock_min} / {p.stock_max || "—"}</dd></div>
                  <div><dt className="text-slate-500">Custo</dt><dd className="font-medium">{(p.cost_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div>
                  <div><dt className="text-slate-500">SKU</dt><dd className="font-medium">{p.sku ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Código interno</dt><dd className="font-medium">{p.internal_code ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Barras</dt><dd className="font-medium">{p.barcode ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Fabricante</dt><dd className="font-medium">{p.manufacturer ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Categoria</dt><dd className="font-medium">{p.product_categories?.name ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Fornecedor</dt><dd className="font-medium">{p.suppliers?.name ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">NCM</dt><dd className="font-medium">{p.ncm ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Peso</dt><dd className="font-medium">{p.weight_kg !== null ? `${p.weight_kg} kg` : "—"}</dd></div>
                  <div><dt className="text-slate-500">Garantia</dt><dd className="font-medium">{p.warranty_months !== null ? `${p.warranty_months} meses` : "não aplicável"}</dd></div>
                  <div><dt className="text-slate-500">Suporte</dt><dd className="font-medium">{p.support_months !== null ? `${p.support_months} meses` : "—"}</dd></div>
                </dl>
                {p.description ? <p className="mt-3 text-sm">{p.description}</p> : null}
                {p.notes ? <p className="mt-1 text-sm text-slate-600">{p.notes}</p> : null}
              </Card>
            ),
          },
          {
            id: "lotes",
            label: `Lotes (${batches.length})`,
            content: (
              <Card title="Lotes e validade">
                {batches.length === 0 ? <p className="text-sm text-slate-500">Sem lotes. Informe lote/validade na entrada.</p> : (
                  <ul className="grid gap-2 text-sm">
                    {batches.map((b) => (
                      <li key={b.id} className="flex flex-wrap gap-x-3 rounded-lg border border-slate-200 p-2">
                        <span className="font-semibold">Lote {b.batch ?? "—"}</span>
                        <span>qtd {b.quantity}</span>
                        <span className="text-slate-600">validade {b.expires_at ?? "não aplicável"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
          {
            id: "mov",
            label: "Movimentar",
            content: (
              <Card title="Nova movimentação">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Tipo" value={mov.kind} onChange={(e) => setMov({ ...mov, kind: e.target.value })}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="ajuste">Ajuste (define saldo)</option>
                  </Select>
                  <Input label={mov.kind === "ajuste" ? "Saldo final" : "Quantidade"} value={mov.quantity} onChange={(e) => setMov({ ...mov, quantity: e.target.value })} inputMode="decimal" />
                  <div className="sm:col-span-2"><Input label="Motivo *" value={mov.reason} onChange={(e) => setMov({ ...mov, reason: e.target.value })} /></div>
                  <Input label="Lote (opcional)" value={mov.batch} onChange={(e) => setMov({ ...mov, batch: e.target.value })} />
                  <Input label="Validade (opcional)" type="date" value={mov.expires_at} onChange={(e) => setMov({ ...mov, expires_at: e.target.value })} />
                  <div className="sm:col-span-2"><Button onClick={() => void move()}>Registrar</Button></div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Saída sem saldo é bloqueada. Ajuste define o saldo final.</p>
              </Card>
            ),
          },
          {
            id: "hist",
            label: `Histórico (${movements.length})`,
            content: (
              <Card title="Movimentações">
                <Timeline items={movements.map((m) => ({ title: `${m.kind} ${m.quantity} — por ${m.actor_name}`, detail: m.reason, at: m.created_at }))} />
              </Card>
            ),
          },
          {
            id: "editar",
            label: "Editar",
            content: (
              <Card title="Editar produto">
                <EditForm initial={formValue} suppliers={suppliers} saving={saving} onSave={(v) => void saveEdit(v)} />
              </Card>
            ),
          },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/estoque" className="font-semibold text-brand-700 hover:underline">← Voltar para Estoque</Link>
      </p>
    </section>
  );
}

export default function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <DetailInner id={id} />
    </Suspense>
  );
}
