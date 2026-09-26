-- CorpServices · migration v12 — metas configuraveis (nunca hardcoded).

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  metric text not null check (metric in ('chamados_resolvidos','os_concluidas','compras_concluidas','os_no_prazo')),
  target numeric not null check (target > 0),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

drop policy if exists goals_org on public.goals;
create policy goals_org on public.goals
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());
