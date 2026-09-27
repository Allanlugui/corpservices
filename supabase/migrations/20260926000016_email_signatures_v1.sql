-- CorpServices · migration v16 — assinaturas de e-mail + bucket público p/ imagens.

create table if not exists public.email_signatures (
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null default '',
  job_title text not null default '',
  phone text not null default '',
  body_text text not null default '',
  image_url text,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.email_signatures enable row level security;
-- Sem policies: default-deny; acesso via service_role nas APIs autenticadas.

alter table public.email_queue
  add column if not exists body_html text;

-- Bucket público somente p/ imagens de assinatura (leitura anônima; escrita via service_role).
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

drop policy if exists public_assets_read on storage.objects;
create policy public_assets_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-assets');
