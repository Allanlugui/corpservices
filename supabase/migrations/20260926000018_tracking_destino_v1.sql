-- CorpServices · migration v18 — acompanhamento público segue a conversão.
-- get_ticket_by_token passa a devolver `destino` (OS e/ou compra vinculadas),
-- SOMENTE com número, status e marcos (sem atores, valores ou detalhes internos).
-- O token continua sendo a capability: nada é exposto sem ele.

create or replace function public.get_ticket_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  t record;
  v_os record;
  v_pr record;
begin
  select id, number, kind, status, category, priority, payload, created_at
    into t from public.tickets where tracking_token = p_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select number, status into v_os
    from public.work_orders where ticket_id = t.id
    order by created_at desc limit 1;

  select number, status, id into v_pr
    from public.purchase_requests where ticket_id = t.id
    order by created_at desc limit 1;

  return jsonb_build_object(
    'found', true,
    'ticket', jsonb_build_object(
      'number', t.number, 'kind', t.kind, 'status', t.status,
      'category', t.category, 'priority', t.priority,
      'summary', coalesce(t.payload->>'descricao', t.payload->>'item', ''),
      'created_at', t.created_at
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.created_at) order by e.created_at)
      from public.ticket_events e where e.ticket_id = t.id
    ), '[]'::jsonb),
    'destino_os', case when v_os.number is null then null else jsonb_build_object(
      'number', v_os.number, 'status', v_os.status,
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.created_at) order by e.created_at)
        from public.work_order_events e
        where e.work_order_id = (select id from public.work_orders where ticket_id = t.id order by created_at desc limit 1)
      ), '[]'::jsonb)
    ) end,
    'destino_compra', case when v_pr.number is null then null else jsonb_build_object(
      'number', v_pr.number, 'status', v_pr.status,
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.created_at) order by e.created_at)
        from public.purchase_events e where e.request_id = v_pr.id
      ), '[]'::jsonb)
    ) end
  );
end;
$$;
