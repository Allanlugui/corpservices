-- CorpServices · migration v10 — notificacoes in-app
-- Emissao server-side nos eventos importantes; leitura por usuario.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notif_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
