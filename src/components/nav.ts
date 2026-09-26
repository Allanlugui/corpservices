import {
  Archive,
  Bell,
  ClipboardList,
  FileText,
  Home,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Target,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Action, Module } from "@/domain/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: { module: Module; action: Action };
  children?: { href: string; label: string }[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, perm: { module: "tickets", action: "read" } },
  {
    href: "/chamados",
    label: "Chamados",
    icon: ClipboardList,
    perm: { module: "tickets", action: "read" },
    children: [
      { href: "/chamados", label: "Todos" },
      { href: "/chamados?kind=servico", label: "Serviços" },
      { href: "/chamados?kind=compra", label: "Compras" },
    ],
  },
  { href: "/os", label: "Ordens de Serviço", icon: Wrench, perm: { module: "work_orders", action: "read" } },
  {
    href: "/compras",
    label: "Compras",
    icon: ShoppingCart,
    perm: { module: "purchases", action: "read" },
    children: [
      { href: "/compras?view=requests", label: "Solicitações" },
      { href: "/compras?view=quotes", label: "Cotações" },
      { href: "/compras?view=orders", label: "Pedidos" },
    ],
  },
  { href: "/estoque", label: "Estoque", icon: Package, perm: { module: "inventory", action: "read" } },
  { href: "/arquivos", label: "Arquivos", icon: Archive, perm: { module: "files", action: "read" } },
  { href: "/relatorios", label: "Relatórios", icon: FileText, perm: { module: "reports", action: "read" } },
  { href: "/metas", label: "Metas", icon: Target, perm: { module: "reports", action: "read" } },
  { href: "/notificacoes", label: "Notificações", icon: Bell, perm: { module: "tickets", action: "read" } },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, perm: { module: "audit", action: "read" } },
  { href: "/configuracoes", label: "Configurações", icon: Settings, perm: { module: "settings", action: "read" } },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck, perm: { module: "inventory", action: "read" } },
];
