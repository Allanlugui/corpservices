-- CorpServices · migration v8 — arquivos
-- Bucket privado SEM policies diretas: acesso somente via signed URLs geradas
-- pelo servidor (service_role) após checagem de org + permissão. Default deny.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  owner_type text not null check (owner_type in ('work_order','ticket','purchase','product','checklist_item')),
  owner_id uuid not null,
  folder text not null default 'documentos'
    check (folder in ('antes','durante','depois','documentos','nota_fiscal','foto_checklist')),
  path text not null unique,
  name text not null,
  mime text not null,
  size_bytes integer not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists files_owner_idx on public.files (owner_type, owner_id);
create index if not exists files_org_idx on public.files (org_id);

alter table public.files enable row level security;

drop policy if exists files_org on public.files;
create policy files_org on public.files
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());
