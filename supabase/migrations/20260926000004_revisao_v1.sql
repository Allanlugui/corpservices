-- CorpServices · migration v5 — revisao Chamados/OS/Compras
-- assigned_to em tickets; justification em materiais; requires_photo em checklist;
-- parent_work_order_id (OS filha bloqueia conclusao da pai).

alter table public.tickets
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
create index if not exists tickets_assigned_idx on public.tickets (assigned_to);

alter table public.work_order_materials
  add column if not exists justification text not null default '';

alter table public.work_order_checklists
  add column if not exists requires_photo boolean not null default false;

alter table public.work_orders
  add column if not exists parent_work_order_id uuid references public.work_orders (id) on delete restrict;
create index if not exists work_orders_parent_idx on public.work_orders (parent_work_order_id);
