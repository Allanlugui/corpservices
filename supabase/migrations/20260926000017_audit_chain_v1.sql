-- CorpServices · migration v17 — D-09 hash-chain append-only.
-- Cadeia: hash = sha256(prev || org || event || detail || created_at).
-- Linhas antigas: version 1 (link pelo id); novas: version 2 (conteúdo completo).

alter table public.audit_events
  add column if not exists previous_hash text,
  add column if not exists hash text,
  add column if not exists hash_version integer not null default 2;

create extension if not exists pgcrypto with schema extensions;

-- Backfill v1 encadeado POR ORG (ordem de criação).
do $$
declare
  o record;
  r record;
  prev text;
begin
  for o in select distinct org_id from public.audit_events
  loop
    prev := '';
    for r in select id from public.audit_events
             where org_id is not distinct from o.org_id and hash is null
             order by created_at, id
    loop
      update public.audit_events
        set previous_hash = prev,
            hash = encode(digest(prev || '|' || r.id::text, 'sha256'), 'hex'),
            hash_version = 1
        where id = r.id;
      select ae.hash into prev from public.audit_events ae where ae.id = r.id;
    end loop;
  end loop;
end $$;

-- Append-only de verdade: autenticado só lê; escrita só via service_role.
drop policy if exists audit_events_org on public.audit_events;
drop policy if exists audit_events_read on public.audit_events;
create policy audit_events_read on public.audit_events
  for select to authenticated
  using (org_id = public.my_org_id() or org_id is null);
