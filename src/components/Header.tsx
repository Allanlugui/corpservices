"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { Breadcrumb } from "./ui/breadcrumb";
import { Dropdown } from "./ui/pagination";
import { IconButton } from "./ui/button";
import { useSync } from "@/hooks/useSync";
import type { Me } from "@/hooks/useMe";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chamados": "Chamados",
  "/os": "Ordens de Serviço",
  "/compras": "Compras",
  "/estoque": "Estoque",
  "/arquivos": "Arquivos",
  "/perfil": "Meu perfil",
  "/auditoria": "Auditoria",
  "/configuracoes": "Configurações",
};

function SyncBadge({ sync }: { sync: ReturnType<typeof useSync> }) {
  const { online, pending, syncing, lastResult, remoteTotal } = sync;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="status"
        title={online ? "Conectado" : "Sem conexão — operações vão para a fila"}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${online ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${online ? "bg-emerald-600" : "bg-red-600"}`} />
        {syncing ? "SINCRONIZANDO" : online ? "ONLINE" : "OFFLINE"}
      </span>
      {pending > 0 ? (
        <span role="status" title={lastResult ?? `${pending} operação(ões) na fila`} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
          {pending} PENDENTE{pending > 1 ? "S" : ""}
        </span>
      ) : null}
      {pending === 0 && remoteTotal > 0 ? (
        <span role="status" title="Mudanças no servidor desde o último sync — recarregue as listas" className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
          {remoteTotal} NOVIDADE{remoteTotal > 1 ? "S" : ""}
        </span>
      ) : null}
    </span>
  );
}

export function Header({ me, onMenu }: { me: Me | null; onMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const sync = useSync();
  const [notifs, setNotifs] = useState<{ id: string; title: string; link: string | null; read_at: string | null; created_at: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const title = TITLES[pathname] ?? "CorpServices";

  function loadNotifs() {
    fetch("/api/notificacoes")
      .then(async (res) => {
        const json = await res.json();
        if (!json.error) {
          setNotifs((json.data.notifications ?? []).slice(0, 5));
          setUnread(json.data.unread as number);
        }
      })
      .catch(() => {
        /* sino silencioso */
      });
  }

  useEffect(() => {
    if (!me) return;
    void loadNotifs();
    const t = setInterval(() => {
      void loadNotifs();
    }, 60000);
    return () => clearInterval(t);
  }, [me, pathname]);

  async function markAll(close: () => void) {
    await fetch("/api/notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {});
    close();
    void loadNotifs();
  }

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
        <SyncBadge sync={sync} />
        {sync.pending > 0 && !sync.syncing ? (
          <button
            type="button"
            onClick={() => void sync.sync()}
            className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-200"
          >
            Sincronizar
          </button>
        ) : null}
        <Dropdown
          label={
            <span className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/70" role="button" aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}>
              <Bell size={18} />
              {unread > 0 ? (
                <span aria-hidden className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </span>
          }
        >
          {(close) => (
            <div className="grid w-72 gap-1 p-2 text-sm">
              <p className="px-2 py-1 text-xs font-bold uppercase text-slate-500">Recentes</p>
              {notifs.length === 0 ? (
                <p className="px-2 py-2 text-slate-500">Nada por aqui.</p>
              ) : (
                notifs.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "/notificacoes"}
                    onClick={() => close()}
                    className={`rounded-lg px-2 py-2 hover:bg-slate-100 ${n.read_at ? "text-slate-600" : "font-semibold"}`}
                  >
                    {n.title}
                  </Link>
                ))
              )}
              <div className="mt-1 flex gap-2 border-t border-slate-100 pt-2">
                <Link href="/notificacoes" onClick={() => close()} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white">
                  Ver todas
                </Link>
                <button
                  type="button"
                  onClick={() => void markAll(close)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  Marcar lidas
                </button>
              </div>
            </div>
          )}
        </Dropdown>
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
              <Link
                href="/perfil"
                role="menuitem"
                onClick={() => close()}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left font-medium hover:bg-slate-100"
              >
                <User size={16} /> Meu perfil
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { close(); void logout(); }}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left font-medium hover:bg-slate-100"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
