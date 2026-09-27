-- CorpServices · migration v22 — anti-spam de alertas proativos (§24).
-- Uma linha por (org, chave): o checker só re-notifica após 24h.

create table if not exists public.alert_states (
  org_id uuid not null references public.organizations (id) on delete restrict,
  alert_key text not null,
  last_sent_at timestamptz not null default now(),
  primary key (org_id, alert_key)
);

alter table public.alert_states enable row level security;
-- Sem policies: default-deny; acesso via service_role (checker).
