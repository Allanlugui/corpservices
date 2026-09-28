"use client";

import { useState } from "react";

/** Interruptor acessível (role=switch, teclado incluído). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-300"} ${disabled ? "opacity-40" : ""}`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

/** Avatar com foto ou inicial; tamanho configurável. */
export function UserAvatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size }} className="rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.375) }}
      className="inline-flex items-center justify-center rounded-full bg-slate-900 font-bold text-white"
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Alerta inline por tom (info/sucesso/aviso/erro). */
export function Alert({ tone, children }: { tone: "info" | "ok" | "warn" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : tone === "error"
          ? "bg-red-50 text-red-700"
          : "bg-sky-50 text-sky-900";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-medium ${cls}`}>
      {children}
    </p>
  );
}

/** Caixa de seleção com busca (lista longa sem scroll infinito). */
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-800">
        {label}
        <input
          value={open ? q : (current?.label ?? "")}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQ("");
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? "Buscar…"}
          role="combobox"
          aria-expanded={open}
          aria-controls="combobox-list"
          aria-label={label}
          autoComplete="off"
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      {open ? (
        <ul id="combobox-list" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <li role="option" aria-selected={value === ""}>
            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100" onMouseDown={() => { onChange(""); setOpen(false); }}>
              Limpar
            </button>
          </li>
          {filtered.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100" onMouseDown={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">Nada encontrado.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/** Intervalo de datas (de/até) com valores ISO. */
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (v: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block text-sm font-medium text-slate-800">
        De
        <input type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Até
        <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
    </div>
  );
}
