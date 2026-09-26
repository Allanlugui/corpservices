-- CorpServices · migration v3 — ordens de servico
-- RLS default-deny; somente autenticados da mesma org. RETOMADA e evento (ver D-15).

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  number serial,
  ticket_id uuid references public.tickets (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'ABERTA'
    check (status in ('ABERTA','ATRIBUIDA','EM_EXECUCAO','PAUSADA','CONCLUIDA','VALIDACAO','ENCERRADA')),
  priority text not null default 'media'
    check (priority in ('baixa','media','alta','critica')),
  location text,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  sla_total_ms bigint not null default 864000000,
  sla_remaining_ms bigint not null default 864000000,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_orders_org_idx on public.work_orders (org_id);
create index if not exists work_orders_status_idx on public.work_orders (status);
create index if not exists work_orders_assigned_idx on public.work_orders (assigned_to);

create table if not exists public.pause_reasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  active boolean not null default true,
  unique (org_id, label)
);

create table if not exists public.work_order_pauses (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  reason text not null,
  paused_at timestamptz not null default now(),
  resumed_at timestamptz,
  duration_ms bigint,
  sla_before_ms bigint not null,
  sla_after_ms bigint,
  paused_by uuid references public.profiles (id) on delete set null,
  resumed_by uuid references public.profiles (id) on delete set null
);
create index if not exists wo_pauses_wo_idx on public.work_order_pauses (work_order_id);

create table if not exists public.work_order_checklists (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  position integer not null default 0
);

create table if not exists public.work_order_materials (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  product_name text not null,
  quantity numeric not null default 1,
  unit text not null default 'un',
  consumed_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists wo_events_wo_idx on public.work_order_events (work_order_id);

-- ============ RLS (mesma org, autenticado) ============

alter table public.work_orders enable row level security;
alter table public.pause_reasons enable row level security;
alter table public.work_order_pauses enable row level security;
alter table public.work_order_checklists enable row level security;
alter table public.work_order_materials enable row level security;
alter table public.work_order_events enable row level security;

drop policy if exists wo_org on public.work_orders;
create policy wo_org on public.work_orders
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists pause_reasons_org on public.pause_reasons;
create policy pause_reasons_org on public.pause_reasons
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists wo_pauses_org on public.work_order_pauses;
create policy wo_pauses_org on public.work_order_pauses
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()));

drop policy if exists wo_checklists_org on public.work_order_checklists;
create policy wo_checklists_org on public.work_order_checklists
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()));

drop policy if exists wo_materials_org on public.work_order_materials;
create policy wo_materials_org on public.work_order_materials
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()));

drop policy if exists wo_events_org on public.work_order_events;
create policy wo_events_org on public.work_order_events
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and w.org_id = public.my_org_id()));
