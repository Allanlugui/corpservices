/**
 * RBAC — fonte única de verdade dos papéis e permissões (espelha
 * memory/ARCHITECTURE.md §5). Funções puras: testáveis sem I/O.
 * A aplicação real SEMPRE revalida no backend (RLS + checks server-side);
 * este módulo serve à UI e aos testes de regra.
 */

export const ROLES = [
  "admin",
  "gestor",
  "solicitante",
  "comprador",
  "tecnico",
  "estoque",
  "auditor",
] as const;
export type Role = (typeof ROLES)[number];

export const MODULES = [
  "tickets",
  "work_orders",
  "purchases",
  "inventory",
  "files",
  "reports",
  "settings",
  "audit",
] as const;
export type Module = (typeof MODULES)[number];

export type Action = "read" | "create" | "update" | "delete" | "approve" | "execute" | "manage";

type Grant = `${Module}:${Action}` | `${Module}:*` | "*:*";

const GRANTS: Record<Role, Grant[]> = {
  admin: ["*:*"],
  gestor: [
    "tickets:*",
    "work_orders:*",
    "purchases:*",
    "inventory:read",
    "files:*",
    "reports:*",
    "settings:read",
    "settings:update",
    "audit:read",
  ],
  solicitante: ["tickets:create", "tickets:read", "work_orders:read", "purchases:read", "files:create", "files:read", "reports:read"],
  comprador: [
    "work_orders:read",
    "purchases:create",
    "purchases:read",
    "purchases:update",
    "inventory:read",
    "files:create",
    "files:read",
    "reports:read",
  ],
  tecnico: [
    "tickets:read",
    "work_orders:read",
    "work_orders:update",
    "work_orders:execute",
    "purchases:read",
    "inventory:read",
    "files:create",
    "files:read",
    "reports:read",
  ],
  estoque: [
    "work_orders:read",
    "purchases:read",
    "purchases:update",
    "inventory:*",
    "files:create",
    "files:read",
    "reports:read",
  ],
  auditor: [
    "tickets:read",
    "work_orders:read",
    "purchases:read",
    "inventory:read",
    "files:read",
    "reports:read",
    "settings:read",
    "audit:read",
  ],
};

export function can(role: Role, module: Module, action: Action): boolean {
  const grants = GRANTS[role];
  return (
    grants.includes("*:*") ||
    grants.includes(`${module}:*` as Grant) ||
    grants.includes(`${module}:${action}` as Grant)
  );
}

/** Papeis válidos vindos do banco; qualquer outro valor é rejeitado (fail-closed). */
export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}
