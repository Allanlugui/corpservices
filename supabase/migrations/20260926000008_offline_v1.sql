-- CorpServices · migration v9 — idempotencia offline
-- client_key: mesma operacao reenviada retorna o registro existente, nunca duplica.

alter table public.tickets
  add column if not exists client_key uuid unique;

alter table public.ticket_events
  add column if not exists client_key uuid;

alter table public.work_order_events
  add column if not exists client_key uuid;

create index if not exists ticket_events_client_key_idx on public.ticket_events (client_key) where client_key is not null;
create index if not exists wo_events_client_key_idx on public.work_order_events (client_key) where client_key is not null;
