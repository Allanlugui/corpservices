"use client";

import { X } from "lucide-react";
import { IconButton } from "./button";

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold">{title}</h2>
          <IconButton label="Fechar menu" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto p-2">{children}</div>
      </aside>
    </div>
  );
}
