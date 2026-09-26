-- CorpServices · migration v2 — tickets + triagem BotIA
-- APLICAR via psql direto (sem CLI). RLS default-deny; portal publico insere via policy anon restrita.

-- ============ tickets ============

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  number serial,
  kind text not null check (kind in ('servico', 'compra')),
  status text not null default 'NOVO'
    check (status in ('NOVO','EM_TRIAGEM','EM_ANALISE','CONVERTIDO','RESOLVIDO','ENCERRADO')),
  -- identificacao do solicitante (portal publico pode ser anonimo)
  requester_name text not null,
  requester_email text not null,
  requester_profile_id uuid references public.profiles (id) on delete set null,
  -- classificacao (preenchida pelo BotIA / gestor)
  category text,
  priority text check (priority in ('baixa','media','alta','critica')),
  ai_suggested_kind text check (ai_suggested_kind in ('servico','compra')),
  ai_missing_fields text[] not null default '{}',
  -- conteudo especifico por tipo (jsonb validado na aplicacao via zod)
  payload jsonb not null default '{}',
  -- link seguro de acompanhamento
  tracking_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_org_idx on public.tickets (org_id);
create index if not exists tickets_status_idx on public.tickets (status);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_kind text not null check (author_kind in ('solicitante','atendente','bot','sistema')),
  author_profile_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  file_path text not null,
  mime text,
  size_bytes integer,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists ticket_events_ticket_idx on public.ticket_events (ticket_id);

-- ============ BotIA auditavel ============

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  ticket_id uuid references public.tickets (id) on delete set null,
  channel text not null default 'portal',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  action text not null,
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ RLS ============

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_actions enable row level security;

-- Portal publico (anon): pode CRIAR ticket, nada mais.
-- org alvo: primeira organizacao (single-tenant v1); multi-org no portal chega com convites.
drop policy if exists tickets_anon_insert on public.tickets;
create policy tickets_anon_insert on public.tickets
  for insert to anon
  with check (
    kind in ('servico', 'compra')
    and requester_profile_id is null
    and status = 'NOVO'
  );

-- Leitura/escrita interna: mesma org (permissoes finas por acao na aplicacao + RBAC).
drop policy if exists tickets_org_rw on public.tickets;
create policy tickets_org_rw on public.tickets
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists ticket_messages_org on public.ticket_messages;
create policy ticket_messages_org on public.ticket_messages
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()));

drop policy if exists ticket_attachments_org on public.ticket_attachments;
create policy ticket_attachments_org on public.ticket_attachments
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()));

drop policy if exists ticket_events_org on public.ticket_events;
create policy ticket_events_org on public.ticket_events
  for all to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and t.org_id = public.my_org_id()));

drop policy if exists ai_org on public.ai_conversations;
create policy ai_org on public.ai_conversations
  for all to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists ai_messages_org on public.ai_messages;
create policy ai_messages_org on public.ai_messages
  for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.org_id = public.my_org_id()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.org_id = public.my_org_id()));

drop policy if exists ai_actions_org on public.ai_actions;
create policy ai_actions_org on public.ai_actions
  for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.org_id = public.my_org_id()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.org_id = public.my_org_id()));

-- Acompanhamento publico via token: RPC SECURITY DEFINER (nao expoe tabela ao anon).
create or replace function public.get_ticket_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  t record;
begin
  select id, number, kind, status, category, priority, payload, created_at
    into t from public.tickets where tracking_token = p_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;
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
    ), '[]'::jsonb)
  );
end;
$$;
