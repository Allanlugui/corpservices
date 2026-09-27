-- CorpServices · migration v21 — locais/estrutura física.
-- Árvore simples (parent_id): ex. Matriz > Andar 2 > Sala 205.
-- Ticket guarda location_id + detalhe livre; OS herda na criação.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  parent_id uuid references public.locations (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, parent_id, name)
);
create index if not exists locations_org_idx on public.locations (org_id, active);

alter table public.tickets
  add column if not exists location_id uuid references public.locations (id) on delete set null,
  add column if not exists location_detail text not null default '';

alter table public.work_orders
  add column if not exists location_id uuid references public.locations (id) on delete set null,
  add column if not exists location_detail text not null default '';

alter table public.locations enable row level security;

drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations
  for select to authenticated
  using (org_id = public.my_org_id());

-- Lista pública p/ o portal (somente id/nome/caminho, sem auth; via RPC).
create or replace function public.list_locations()
returns jsonb language sql security definer set search_path = public stable as $$
  with recursive tree(id, name, parent_id, path) as (
    select l.id, l.name, l.parent_id, l.name::text
      from public.locations l
     where l.parent_id is null and l.active
    union all
    select l.id, l.name, l.parent_id, tree.path || ' › ' || l.name
      from public.locations l join tree on l.parent_id = tree.id
     where l.active
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', path) order by path), '[]'::jsonb) from tree;
$$;
