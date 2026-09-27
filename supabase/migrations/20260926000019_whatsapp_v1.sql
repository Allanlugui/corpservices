-- CorpServices · migration v19 — WhatsApp (Fase 18, Meta Cloud API via env).
-- Segredos WHATSAPP_TOKEN/WHATSAPP_PHONE_ID SOMENTE em env. Telefone do
-- usuário em profiles.phone (o próprio usuário edita em Configurações).

alter table public.profiles
  add column if not exists phone text not null default '';

create table if not exists public.whatsapp_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  to_phone text not null,
  body text not null default '',
  kind text not null default '',
  link text,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','SKIPPED')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists wa_queue_pending_idx on public.whatsapp_queue (org_id, created_at) where status = 'PENDING';

alter table public.whatsapp_queue enable row level security;
-- Sem policies: default-deny; somente service_role (worker) lê/escreve.
