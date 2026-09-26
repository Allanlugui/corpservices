import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className={CONTROL} {...props} />
    </Field>
  );
}

export function Select({
  label,
  hint,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <select className={CONTROL} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className={CONTROL} {...props} />
    </Field>
  );
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
      <input type="checkbox" className="h-4 w-4 accent-slate-900" {...props} />
      {label}
    </label>
  );
}

export function Switch({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-800">
      {label}
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span aria-hidden className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-900 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600" />
    </label>
  );
}
