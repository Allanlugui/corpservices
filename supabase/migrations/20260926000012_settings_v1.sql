-- CorpServices · migration v13 — parametros por org (só com consumidor real).

create table if not exists public.app_settings (
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_org on public.app_settings;
create policy app_settings_org on public.app_settings
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());
