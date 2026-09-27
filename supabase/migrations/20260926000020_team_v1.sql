-- CorpServices · migration v20 — equipe, perfil e permissões por usuário.
-- Overlay: nega/permitir por (usuário, módulo, ação); deny vence; vazio = papel.

alter table public.profiles
  add column if not exists avatar_url text not null default '',
  add column if not exists department text not null default '',
  add column if not exists position text not null default '',
  add column if not exists must_reset boolean not null default false;

create table if not exists public.user_permissions (
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  action text not null,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, module, action)
);

alter table public.user_permissions enable row level security;
-- Sem policies: default-deny; acesso via service_role nas APIs (admin/gestor).
