-- CorpServices · migration v6 — estoque
-- Entrada tolerante (D-11): campos opcionais ausentes => cadastro_incompleto + pendencia, nunca bloqueio.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  doc text,
  contact text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  unique (org_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  category_id uuid references public.product_categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null,
  description text not null default '',
  unit text not null default 'un',
  location text,
  stock_min numeric not null default 0,
  stock_max numeric not null default 0,
  quantity numeric not null default 0,
  cost_cents bigint not null default 0,
  sku text,
  internal_code text,
  barcode text,
  manufacturer text,
  warranty_months integer,
  support_months integer,
  notes text not null default '',
  cadastro_incompleto boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_org_idx on public.products (org_id);
create index if not exists products_name_idx on public.products using gin (to_tsvector('portuguese', name));

create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  batch text,
  expires_at date,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists batches_product_idx on public.product_batches (product_id);
create index if not exists batches_expires_idx on public.product_batches (expires_at);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete set null,
  kind text not null check (kind in ('entrada','saida','ajuste')),
  quantity numeric not null check (quantity > 0),
  reason text not null default '',
  work_order_id uuid references public.work_orders (id) on delete set null,
  purchase_id uuid references public.purchase_requests (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mov_product_idx on public.inventory_movements (product_id);
create index if not exists mov_created_idx on public.inventory_movements (created_at);

-- ============ RLS (mesma org, autenticado) ============

alter table public.suppliers enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists suppliers_org on public.suppliers;
create policy suppliers_org on public.suppliers
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists categories_org on public.product_categories;
create policy categories_org on public.product_categories
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists products_org on public.products;
create policy products_org on public.products
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists batches_org on public.product_batches;
create policy batches_org on public.product_batches
  for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.org_id = public.my_org_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.org_id = public.my_org_id()));

drop policy if exists mov_org on public.inventory_movements;
create policy mov_org on public.inventory_movements
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());
