"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV } from "./nav";
import { can, parseRole } from "@/domain/rbac";
import { Tooltip } from "./ui/tooltip";
import { IconButton } from "./ui/button";
import type { Me } from "@/hooks/useMe";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  me,
  collapsed,
  onToggle,
  onNavigate,
}: {
  me: Me | null;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = parseRole(me?.role);
  const items = NAV.filter((item) => (role ? can(role, item.perm.module, item.perm.action) : false));

  return (
    <div className={`flex h-full flex-col bg-slate-900 text-slate-200 ${collapsed ? "w-16" : "w-60"}`}>
      <div className={`flex items-center px-3 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed ? (
          <Link href="/" onClick={onNavigate} className="text-lg font-bold tracking-tight text-white">
            CorpServices
          </Link>
        ) : null}
        <IconButton
          label={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={onToggle}
          className="text-slate-300 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </IconButton>
      </div>
      <nav aria-label="Principal" className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        <ul className="grid gap-0.5">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon size={18} aria-hidden className="shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
            return (
              <li key={item.href}>
                {collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}
                {!collapsed && active && item.children ? (
                  <ul className="ml-9 mt-0.5 grid gap-0.5 border-l border-white/10 pl-2">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === "/chamados" &&
                        (searchParams.get("kind") ?? "") === new URL(child.href, "http://x").searchParams.get("kind");
                      return (
                        <li key={child.label}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            className={`block rounded px-2 py-1.5 text-xs ${childActive ? "font-semibold text-white" : "text-slate-400 hover:text-white"}`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
      {!collapsed ? (
        <p className="px-4 py-3 text-[11px] leading-tight text-slate-500">
          Fila offline real: Fase 09. Nada aqui finge sincronia.
        </p>
      ) : null}
    </div>
  );
}
