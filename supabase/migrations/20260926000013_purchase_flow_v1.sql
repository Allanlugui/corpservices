-- CorpServices · migration v14 — fase 06b (tratativa do pedido + recibo).

alter table public.purchase_orders
  add column if not exists delivery_deadline date,
  add column if not exists tracking_code text,
  add column if not exists notes text not null default '';

alter table public.files drop constraint if exists files_folder_check;
alter table public.files
  add constraint files_folder_check check (folder in ('antes','durante','depois','documentos','nota_fiscal','foto_checklist','recibo_pagamento'));
