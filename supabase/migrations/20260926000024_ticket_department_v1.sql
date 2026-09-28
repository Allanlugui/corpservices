-- CorpServices · migration v24 — departamento no ticket (filtro P-10).

alter table public.tickets
  add column if not exists department text not null default '';
