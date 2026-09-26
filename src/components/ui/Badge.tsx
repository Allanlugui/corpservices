import type { ReactNode } from "react";

const TONES: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  warn: "bg-amber-100 text-amber-900",
  pending: "bg-slate-200 text-slate-700",
  blocked: "bg-red-100 text-red-900",
  info: "bg-brand-100 text-brand-900",
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

const STATUS_TONE: Record<string, string> = {
  NOVO: "warn",
  EM_TRIAGEM: "info",
  EM_ANALISE: "info",
  CONVERTIDO: "info",
  RESOLVIDO: "ok",
  ENCERRADO: "pending",
  ABERTA: "warn",
  ATRIBUIDA: "info",
  EM_EXECUCAO: "info",
  PAUSADA: "warn",
  CONCLUIDA: "ok",
  VALIDACAO: "info",
  SOLICITADA: "warn",
  APROVADA: "ok",
  REJEITADA: "blocked",
  CANCELADA: "blocked",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "pending"}>{status.replaceAll("_", " ")}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-xs text-slate-400">—</span>;
  const tone = priority === "critica" ? "blocked" : priority === "alta" ? "warn" : "pending";
  return <Badge tone={tone}>{priority}</Badge>;
}
