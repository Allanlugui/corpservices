-- CorpServices · migration v11 — auditoria de acesso + grant auditor + logs de sistema

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  event text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_idx on public.audit_events (org_id, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_org on public.audit_events;
create policy audit_events_org on public.audit_events
  for all to authenticated
  using (org_id = public.my_org_id() or org_id is null)
  with check (org_id = public.my_org_id() or org_id is null);

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('debug','info','warn','error')),
  source text not null,
  message text not null,
  meta jsonb not null default '{}',
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists system_logs_created_idx on public.system_logs (created_at desc);
create index if not exists system_logs_level_idx on public.system_logs (level);

alter table public.system_logs enable row level security;

drop policy if exists system_logs_admin on public.system_logs;
create policy system_logs_admin on public.system_logs
  for all to authenticated
  using (public.my_role() in ('admin', 'gestor', 'auditor'))
  with check (true);

-- Auditor enxerga o hub de Configurações (somente leitura do hub; mutações seguem de admin).
insert into public.app_permissions (key, description) values ('settings:read', 'settings:read')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, perm_key) values ('auditor', 'settings:read')
on conflict do nothing;
