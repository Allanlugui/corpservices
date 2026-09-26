-- CorpServices · migration v4 — compras (duas arvores, uma infra)
-- Origem identificavel: ticket (cliente) ou work_order (OS pausada). Ver D-06/D-16.

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  number serial,
  origin text not null check (origin in ('TICKET','WORK_ORDER','MANUAL')),
  ticket_id uuid references public.tickets (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  status text not null default 'SOLICITADA'
    check (status in ('SOLICITADA','EM_ANALISE','DESIGNADA','COTACAO','AGUARDANDO_APROVACAO','APROVADA','NEGOCIACAO','PAGAMENTO','EM_TRANSITO','RECEBIDA','CONCLUIDA','REJEITADA','CANCELADA')),
  priority text not null default 'media'
    check (priority in ('baixa','media','alta','critica')),
  justification text not null default '',
  rejection_reason text,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_origin_link check (
    (origin = 'TICKET' and ticket_id is not null and work_order_id is null) or
    (origin = 'WORK_ORDER' and work_order_id is not null and ticket_id is null) or
    (origin = 'MANUAL' and ticket_id is null and work_order_id is null)
  )
);
create index if not exists pr_org_idx on public.purchase_requests (org_id);
create index if not exists pr_status_idx on public.purchase_requests (status);
create index if not exists pr_wo_idx on public.purchase_requests (work_order_id);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  item text not null,
  description text not null default '',
  quantity numeric not null default 1,
  desired_deadline text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  supplier text not null,
  amount_cents bigint not null default 0,
  currency text not null default 'BRL',
  notes text not null default '',
  chosen boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  supplier text not null,
  amount_cents bigint not null default 0,
  currency text not null default 'BRL',
  status text not null default 'ABERTO'
    check (status in ('ABERTO','PAGO','RECEBIDO','CANCELADO')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists pe_req_idx on public.purchase_events (request_id);

-- ============ RLS (mesma org, autenticado) ============

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.purchase_quotes enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_events enable row level security;

drop policy if exists pr_org on public.purchase_requests;
create policy pr_org on public.purchase_requests
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists pri_org on public.purchase_request_items;
create policy pri_org on public.purchase_request_items
  for all to authenticated
  using (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()))
  with check (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()));

drop policy if exists pq_org on public.purchase_quotes;
create policy pq_org on public.purchase_quotes
  for all to authenticated
  using (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()))
  with check (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()));

drop policy if exists po_org on public.purchase_orders;
create policy po_org on public.purchase_orders
  for all to authenticated
  using (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()))
  with check (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()));

drop policy if exists pe_org on public.purchase_events;
create policy pe_org on public.purchase_events
  for all to authenticated
  using (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()))
  with check (exists (select 1 from public.purchase_requests r where r.id = request_id and r.org_id = public.my_org_id()));
