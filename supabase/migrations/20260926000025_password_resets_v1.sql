-- CorpServices · migration v25 — reset de senha pelo gestor (token próprio).
-- Sem SMTP do Supabase, sem redirect externo: link nosso + e-mail nosso.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pwd_reset_user_idx on public.password_resets (user_id, expires_at);

alter table public.password_resets enable row level security;
-- Sem policies: default-deny; acesso via service_role (APIs autenticadas).
