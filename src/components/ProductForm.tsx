"use client";

import { useState } from "react";
import { Input, Select, Textarea } from "./ui/fields";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

export interface ProductFormValue {
  name: string;
  description: string;
  unit: string;
  category: string;
  supplier_id: string;
  location: string;
  stock_min: string;
  stock_max: string;
  cost: string;
  sku: string;
  internal_code: string;
  barcode: string;
  manufacturer: string;
  warranty_months: string;
  support_months: string;
  ncm: string;
  weight_kg: string;
  notes: string;
}

export const EMPTY_FORM: ProductFormValue = {
  name: "", description: "", unit: "un", category: "", supplier_id: "",
  location: "", stock_min: "0", stock_max: "0", cost: "0",
  sku: "", internal_code: "", barcode: "", manufacturer: "",
  warranty_months: "", support_months: "", ncm: "", weight_kg: "", notes: "",
};

/** Formulário espelho da ficha: os mesmos campos da criação e da edição. */
export function ProductForm({
  value,
  onChange,
  suppliers,
  submitLabel,
  onSubmit,
  busy,
}: {
  value: ProductFormValue;
  onChange: (v: ProductFormValue) => void;
  suppliers: { id: string; name: string }[];
  submitLabel: string;
  onSubmit: () => void;
  busy: boolean;
}) {
  const toast = useToast();
  const [touched, setTouched] = useState(false);
  const set = (k: keyof ProductFormValue, v: string) => onChange({ ...value, [k]: v });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!value.name.trim()) {
      toast("Nome é obrigatório.", "error");
      return;
    }
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2" noValidate={false}>
      <div className="sm:col-span-2">
        <Input label="Nome *" value={value.name} onChange={(e) => set("name", e.target.value)} required />
        {touched && !value.name.trim() ? <p role="alert" className="text-xs text-red-700">Nome é obrigatório.</p> : null}
      </div>
      <div className="sm:col-span-2">
        <Textarea label="Descrição" value={value.description} onChange={(e) => set("description", e.target.value)} rows={2} />
      </div>
      <Input label="Unidade *" value={value.unit} onChange={(e) => set("unit", e.target.value)} required hint="un, cx, l, kg…" />
      <Input label="Categoria" value={value.category} onChange={(e) => set("category", e.target.value)} />
      <Select label="Fornecedor" value={value.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}>
        <option value="">—</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Input label="Localização" value={value.location} onChange={(e) => set("location", e.target.value)} hint="Corredor/prateleira" />
      <Input label="Estoque mínimo *" value={value.stock_min} onChange={(e) => set("stock_min", e.target.value)} inputMode="numeric" required />
      <Input label="Estoque máximo" value={value.stock_max} onChange={(e) => set("stock_max", e.target.value)} inputMode="numeric" hint="0 = sem limite" />
      <Input label="Custo (R$)" value={value.cost} onChange={(e) => set("cost", e.target.value)} inputMode="decimal" />
      <Input label="SKU" value={value.sku} onChange={(e) => set("sku", e.target.value)} />
      <Input label="Código interno" value={value.internal_code} onChange={(e) => set("internal_code", e.target.value)} />
      <Input label="Código de barras" value={value.barcode} onChange={(e) => set("barcode", e.target.value)} />
      <Input label="Fabricante" value={value.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
      <Input label="Garantia (meses)" value={value.warranty_months} onChange={(e) => set("warranty_months", e.target.value)} inputMode="numeric" hint="Vazio = não aplicável" />
      <Input label="Suporte (meses)" value={value.support_months} onChange={(e) => set("support_months", e.target.value)} inputMode="numeric" />
      <Input label="NCM" value={value.ncm} onChange={(e) => set("ncm", e.target.value)} inputMode="numeric" hint="Opcional" />
      <Input label="Peso (kg)" value={value.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} inputMode="decimal" hint="Opcional" />
      <div className="sm:col-span-2">
        <Textarea label="Observações" value={value.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

/** Converte API -> formulário e formulário -> payload da API. */
export function toPayload(v: ProductFormValue) {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
  return {
    name: v.name.trim(),
    description: v.description,
    unit: v.unit.trim() || "un",
    category: v.category.trim() || undefined,
    supplier_id: v.supplier_id || null,
    location: v.location.trim() || null,
    stock_min: Number(v.stock_min) || 0,
    stock_max: Number(v.stock_max) || 0,
    cost_cents: Math.round((num(v.cost) ?? 0) * 100),
    sku: v.sku.trim() || null,
    internal_code: v.internal_code.trim() || null,
    barcode: v.barcode.trim() || null,
    manufacturer: v.manufacturer.trim() || null,
    warranty_months: num(v.warranty_months) ?? null,
    support_months: num(v.support_months) ?? null,
    ncm: v.ncm.trim() || null,
    weight_kg: num(v.weight_kg) ?? null,
    notes: v.notes,
  };
}
