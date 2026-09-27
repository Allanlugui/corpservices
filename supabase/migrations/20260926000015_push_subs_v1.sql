-- CorpServices · migration v15 — push subscriptions (Web Push VAPID, Fase 13).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_sub_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- Sem policies: default-deny; somente service_role (sender/APIs autenticadas via admin client).
