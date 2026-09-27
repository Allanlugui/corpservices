-- CorpServices · migration v23 — Fase 29: hash-chain nos eventos de negócio.
-- Cadeia POR ENTIDADE-PAI (ticket/OS/compra). Backfill v1 (elo pelo id);
-- novas linhas v2 (conteúdo completo, via helpers TS).

alter table public.ticket_events
  add column if not exists previous_hash text,
  add column if not exists hash text,
  add column if not exists hash_version integer not null default 2;

alter table public.work_order_events
  add column if not exists previous_hash text,
  add column if not exists hash text,
  add column if not exists hash_version integer not null default 2;

alter table public.purchase_events
  add column if not exists previous_hash text,
  add column if not exists hash text,
  add column if not exists hash_version integer not null default 2;

-- Backfill v1 encadeado por pai.
do $$
declare
  p record;
  r record;
  prev text;
begin
  for p in select distinct ticket_id as pid from public.ticket_events
  loop
    prev := '';
    for r in select id from public.ticket_events where ticket_id = p.pid and hash is null order by created_at, id
    loop
      update public.ticket_events set previous_hash = prev,
        hash = encode(digest(prev || '|' || r.id::text, 'sha256'), 'hex'), hash_version = 1 where id = r.id;
      select te.hash into prev from public.ticket_events te where te.id = r.id;
    end loop;
  end loop;
  for p in select distinct work_order_id as pid from public.work_order_events
  loop
    prev := '';
    for r in select id from public.work_order_events where work_order_id = p.pid and hash is null order by created_at, id
    loop
      update public.work_order_events set previous_hash = prev,
        hash = encode(digest(prev || '|' || r.id::text, 'sha256'), 'hex'), hash_version = 1 where id = r.id;
      select we.hash into prev from public.work_order_events we where we.id = r.id;
    end loop;
  end loop;
  for p in select distinct request_id as pid from public.purchase_events
  loop
    prev := '';
    for r in select id from public.purchase_events where request_id = p.pid and hash is null order by created_at, id
    loop
      update public.purchase_events set previous_hash = prev,
        hash = encode(digest(prev || '|' || r.id::text, 'sha256'), 'hex'), hash_version = 1 where id = r.id;
      select pe.hash into prev from public.purchase_events pe where pe.id = r.id;
    end loop;
  end loop;
end $$;
