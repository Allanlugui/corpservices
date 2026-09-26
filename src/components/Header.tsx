"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { Breadcrumb } from "./ui/breadcrumb";
import { Dropdown } from "./ui/pagination";
import { IconButton } from "./ui/button";
import { useOnline } from "@/hooks/useOnline";
import type { Me } from "@/hooks/useMe";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chamados": "Chamados",
  "/os": "Ordens de Serviço",
  "/compras": "Compras",
  "/estoque": "Estoque",
  "/arquivos": "Arquivos",
  "/relatorios": "Relatórios",
  "/metas": "Metas",
  "/notificacoes": "Notificações",
  "/auditoria": "Auditoria",
  "/configuracoes": "Configurações",
  "/fornecedores": "Fornecedores",
};

function SyncBadge() {
  const online = useOnline();
  return (
    <span
      role="status"
      title={online ? "Conectado" : "Sem conexão — a fila offline chega na Fase 09"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${online ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${online ? "bg-emerald-600" : "bg-red-600"}`} />
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

export function Header({ me, onMenu }: { me: Me | null; onMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "CorpServices";

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-2 px-3 sm:px-5">
        <IconButton label="Abrir menu" onClick={onMenu} className="lg:hidden">
          <Menu size={20} />
        </IconButton>
        <div className="hidden min-w-0 flex-1 sm:block">
          <Breadcrumb items={[{ label: "Início", href: "/" }, ...(pathname === "/" ? [] : [{ label: title }])]} />
        </div>
        <h1 className="flex-1 truncate font-bold sm:hidden">{title}</h1>
        <SyncBadge />
        <Link href="/notificacoes" aria-label="Notificações" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/70">
          <Bell size={18} />
        </Link>
        <Dropdown
          label={
            <>
              <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {(me?.displayName ?? me?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate text-left text-sm md:block">
                <span className="block truncate font-semibold">{me?.displayName ?? me?.email ?? "…"}</span>
                <span className="block truncate text-xs text-slate-500">{me?.role ?? ""}</span>
              </span>
            </>
          }
        >
          {(close) => (
            <div className="grid gap-1 p-1 text-sm">
              <p className="px-3 py-2 text-xs text-slate-500">{me?.email}</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => { close(); void logout(); }}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left font-medium hover:bg-slate-100"
              >
                <LogOut size={16} /> Sair
              </button>
              <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-slate-400">
                <User size={16} /> Perfil (Fase 02+)
              </span>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
