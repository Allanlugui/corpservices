"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-3 flex items-center justify-end gap-1 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Página anterior"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      <span aria-live="polite" className="px-2 text-slate-600">
        {page} de {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label="Próxima página"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function Dropdown({
  label,
  children,
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-200/70"
      >
        {label}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
