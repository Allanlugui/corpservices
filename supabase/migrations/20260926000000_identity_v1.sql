-- CorpServices · migration v1 — identidade, RBAC e RLS
-- APLICAR via Supabase Dashboard > SQL Editor (cole este arquivo inteiro).
-- Espelha src/domain/rbac.ts. RLS default-deny em todas as tabelas.

-- ============ tabelas ============

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.app_roles (
  key text primary key,
  description text not null
);

create table if not exists public.app_permissions (
  key text primary key,
  description text not null
);

create table if not exists public.role_permissions (
  role_key text not null references public.app_roles (key) on delete cascade,
  perm_key text not null references public.app_permissions (key) on delete cascade,
  primary key (role_key, perm_key)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete restrict,
  role_key text not null references public.app_roles (key),
  display_name text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles (org_id);

-- ============ helpers (SECURITY DEFINER quebra recursao do RLS) ============

create or replace function public.my_org_id()
returns uuid language sql security definer set search_path = public stable as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql security definer set search_path = public stable as $$
  select role_key from public.profiles where id = auth.uid()
$$;

-- ============ RLS: default deny + policies explicitas ============

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;

-- organizations: membro le a propria org
drop policy if exists org_read_own on public.organizations;
create policy org_read_own on public.organizations
  for select using (id = public.my_org_id());

-- departments: mesma org le; admin/gestor da org escreve
drop policy if exists dept_read on public.departments;
create policy dept_read on public.departments
  for select using (org_id = public.my_org_id());
drop policy if exists dept_write on public.departments;
create policy dept_write on public.departments
  for all using (
    org_id = public.my_org_id()
    and public.my_role() in ('admin', 'gestor')
  )
  with check (
    org_id = public.my_org_id()
    and public.my_role() in ('admin', 'gestor')
  );

-- catalogos de papeis/permissoes: leitura autenticada
drop policy if exists roles_read on public.app_roles;
create policy roles_read on public.app_roles for select to authenticated using (true);
drop policy if exists perms_read on public.app_permissions;
create policy perms_read on public.app_permissions for select to authenticated using (true);
drop policy if exists role_perms_read on public.role_permissions;
create policy role_perms_read on public.role_permissions for select to authenticated using (true);

-- profiles: proprio perfil legivel; admin/gestor le a org; admin escreve na org
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select using (
    id = auth.uid()
    or (org_id = public.my_org_id() and public.my_role() in ('admin', 'gestor'))
  );
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and org_id = public.my_org_id() and role_key = public.my_role());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (
    org_id = public.my_org_id() and public.my_role() = 'admin'
  )
  with check (
    org_id = public.my_org_id() and public.my_role() = 'admin'
  );

-- ============ seeds (papeis × permissoes = src/domain/rbac.ts) ============

insert into public.app_roles (key, description) values
  ('admin', 'Administrador'),
  ('gestor', 'Gestor'),
  ('solicitante', 'Solicitante/Cliente'),
  ('comprador', 'Comprador'),
  ('tecnico', 'Técnico'),
  ('estoque', 'Responsável pelo estoque'),
  ('auditor', 'Auditor')
on conflict (key) do nothing;

insert into public.app_permissions (key, description)
select distinct g, g from (values
  ('*:*'),
  ('tickets:*'), ('work_orders:*'), ('purchases:*'), ('inventory:*'), ('files:*'),
  ('inventory:read'), ('tickets:create'), ('tickets:read'),
  ('work_orders:read'), ('work_orders:update'), ('work_orders:execute'),
  ('purchases:create'), ('purchases:read'), ('purchases:update'),
  ('inventory:read'), ('files:read'), ('reports:*'), ('reports:read'),
  ('settings:read'), ('settings:update'), ('audit:read')
) as t(g)
on conflict (key) do nothing;

insert into public.role_permissions (role_key, perm_key) values
  ('admin', '*:*'),
  ('gestor', 'tickets:*'), ('gestor', 'work_orders:*'), ('gestor', 'purchases:*'),
  ('gestor', 'inventory:read'), ('gestor', 'files:*'), ('gestor', 'reports:*'),
  ('gestor', 'settings:read'), ('gestor', 'settings:update'), ('gestor', 'audit:read'),
  ('solicitante', 'tickets:create'), ('solicitante', 'tickets:read'),
  ('solicitante', 'work_orders:read'), ('solicitante', 'purchases:read'),
  ('solicitante', 'files:read'), ('solicitante', 'reports:read'),
  ('comprador', 'work_orders:read'), ('comprador', 'purchases:create'),
  ('comprador', 'purchases:read'), ('comprador', 'purchases:update'),
  ('comprador', 'inventory:read'), ('comprador', 'files:read'), ('comprador', 'reports:read'),
  ('tecnico', 'tickets:read'), ('tecnico', 'work_orders:read'),
  ('tecnico', 'work_orders:update'), ('tecnico', 'work_orders:execute'),
  ('tecnico', 'purchases:read'), ('tecnico', 'inventory:read'),
  ('tecnico', 'files:read'), ('tecnico', 'reports:read'),
  ('estoque', 'work_orders:read'), ('estoque', 'purchases:read'),
  ('estoque', 'purchases:update'), ('estoque', 'inventory:*'),
  ('estoque', 'files:read'), ('estoque', 'reports:read'),
  ('auditor', 'tickets:read'), ('auditor', 'work_orders:read'),
  ('auditor', 'purchases:read'), ('auditor', 'inventory:read'),
  ('auditor', 'files:read'), ('auditor', 'reports:read'), ('auditor', 'audit:read')
on conflict do nothing;
