-- CorpServices · migration v27 — F31 CMMS: ativos + reserva de materiais (empenho).
-- Reserva lógica: products.reserved_quantity; disponível = quantity - reserved.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  parent_id uuid references public.assets (id) on delete cascade,
  tag text not null,
  name text not null,
  description text not null default '',
  criticality text not null default 'media' check (criticality in ('baixa','media','alta','critica')),
  location_id uuid references public.locations (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, tag)
);
create index if not exists assets_org_idx on public.assets (org_id, active);

alter table public.tickets
  add column if not exists asset_id uuid references public.assets (id) on delete set null;

alter table public.work_orders
  add column if not exists asset_id uuid references public.assets (id) on delete set null;

alter table public.work_order_materials
  add column if not exists product_id uuid references public.products (id) on delete set null,
  add column if not exists qty_reserved numeric not null default 0,
  add column if not exists qty_used numeric not null default 0,
  add column if not exists status text not null default 'SOLICITADO'
    check (status in ('SOLICITADO','RESERVADO','PARCIAL','RETIRADO','DEVOLVIDO','CANCELADO'));

alter table public.products
  add column if not exists reserved_quantity numeric not null default 0;

alter table public.assets enable row level security;

drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets
  for select to authenticated
  using (org_id = public.my_org_id());
