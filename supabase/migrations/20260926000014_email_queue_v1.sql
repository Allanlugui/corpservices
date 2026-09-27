-- CorpServices · migration v14 — fila de e-mail (Fase 13, provedor Resend via env).
-- Segredo RESEND_API_KEY SOMENTE em env (nunca no banco). Envio via worker /api/notify/process.

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  subject text not null,
  body_text text not null default '',
  kind text not null default '',
  link text,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','SKIPPED')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_queue_pending_idx on public.email_queue (org_id, created_at) where status = 'PENDING';

alter table public.email_queue enable row level security;
-- Sem policies: default-deny; somente service_role (worker) lê/escreve.
