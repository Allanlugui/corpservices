import type { ReactNode } from "react";

const TONES: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  warn: "bg-amber-100 text-amber-900",
  pending: "bg-slate-200 text-slate-700",
  blocked: "bg-red-100 text-red-900",
};

export function Badge({
  tone = "pending",
  children,
}: {
  tone?: keyof typeof TONES | string;
  children: ReactNode;
}) {
  const cls = TONES[tone] ?? TONES.pending;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}
