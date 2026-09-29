-- CorpServices · migration v26 — remetente na fila + config por perfil.
-- Assinatura sai de quem dispara (sender), não de quem recebe.

alter table public.email_queue
  add column if not exists sender_user_id uuid references public.profiles (id) on delete set null;

create table if not exists public.role_settings (
  org_id uuid not null references public.organizations (id) on delete restrict,
  role_key text not null,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, role_key)
);

alter table public.role_settings enable row level security;
-- Sem policies: default-deny; acesso via service_role (gestor/admin).
