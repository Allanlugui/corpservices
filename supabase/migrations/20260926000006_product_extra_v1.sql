-- CorpServices · migration v7 — produto: NCM + peso (opcionais).

alter table public.products
  add column if not exists ncm text,
  add column if not exists weight_kg numeric;
