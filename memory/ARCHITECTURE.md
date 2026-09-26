# Arquitetura: CorpServices

> Estado: PLANEJADO (Fase 00 — aprovada internamente pelo agente, 2026-09-26).
> Precedencia: codigo real > config real > testes > docs > memoria.

## 1. Auditoria Fase 00 (resumo factual)

- Diretorio `F:/DEV/Opencode/corpservices` continha apenas `AGENTS.md` + `memory/` (10 stubs). Nenhum `.bat`, `package.json`, codigo, `.env`, git ou config Vercel/Supabase encontrado.
- `git status`: `fatal: not a git repository`. Sem remote.
- Toolchain host: Node `v24.13.0`, npm `11.6.2` (Windows win32).
- Cerebro global lido: `regras-agente.md` (31+1 secoes), `padroes-codigo.md` (§61 engenharia), `SUBCONSCIENTE.md` (indice neural).
- Serena: `get_current_config` com timeout MCP (`-32001`) — registrado como limitacao nao-bloqueante; memoria local + global cobre continuidade.
- Padroes reutilizaveis herdados do ecossistema (Subconsciente): `SGA-P01` (multi-tenancy dupla barreira), `SGA-D03` (service_role server-only), `SGA-P02` (storage privado tenant-aware), `SGA-P03/P04` (hidratacao/boundaries App Router), `SGA-P05/P07` (evolucao sem quebra), `SGA-P09` (gates: tsc+lint+build+vitest), `SGA-D07` (TS sem any, vitest), `SGA-UX` (PageHeader/StatCard/EmptyState, CSV BOM + print).

## 2. Stack decidida (ver DECISOES.md D-01)

```text
Frontend : Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS
Backend  : Next.js Route Handlers / Server Actions (REST) + Supabase Postgres
Auth     : Supabase Auth + RBAC em tabelas + RLS (default deny)
PWA      : manifest + service worker (somente estaticos, nunca /api) + fila offline (IndexedDB)
Testes   : vitest (unidade/integracao) + tsc + eslint + build como gates
Deploy   : Vercel (producao = validacao) + GitHub (origem)
PDF      : geracao server-side (sem filesystem persistente — stream/download)
```

## 3. Estrutura modular (conceitual → `src/`)

```text
src/
├── app/                    # rotas App Router (Server Components por padrao)
│   ├── (public)/solicitar  # portal publico + BotIA triagem
│   ├── (app)/chamados      # Todos | Servicos | Compras
│   ├── (app)/os            # ordens de servico
│   ├── (app)/compras       # solicitacoes, cotacoes, aprovacoes, pedidos
│   ├── (app)/estoque       # produtos, movimentacoes, alertas
│   ├── (app)/arquivos      # explorador documental
│   ├── (app)/relatorios
│   ├── (app)/dashboard     # por perfil
│   ├── (app)/configuracoes # admin
│   └── api/                # Route Handlers REST {data}/{error}
├── features/               # tickets, work-orders, purchases, inventory, audit, ai, erp, notifications
│   └── <feature>/{schema,service,repository,actions,components}
├── lib/                    # supabase clients (browser/server/admin), auth, rls helpers
├── domain/                 # maquinas de estado puras + calculo SLA (testaveis, sem I/O)
├── infra/                  # ai-provider, erp-adapter, pdf, storage, queue/offline
└── components/ui/          # design system (Button, Input, Modal, Card, Table, Badge, Toast, EmptyState...)
```

## 4. Modelo de dados (nucleo v1 — DDL em Fase 01/02 via migrations)

Entidades (nomes em ingles, snake_case no Postgres):

```text
identity:  profiles, roles, permissions, role_permissions, departments, memberships
tickets:   tickets, ticket_messages, ticket_attachments, ticket_events
os:        work_orders, work_order_events, work_order_pauses, work_order_checklists, work_order_materials
compras:   purchase_requests, purchase_request_items, purchase_quotes, purchase_orders, purchase_events
           + purchase_request_links (origem: TICKET | WORK_ORDER, work_order_id nullable — as duas arvores compartilham infra, origem identificavel)
estoque:   suppliers, products, product_categories, product_batches, inventory, inventory_movements, inventory_adjustments
arquivos:  files (entidade polimorfica: owner_type + owner_id + pasta logica)
sistema:   notifications, notification_prefs, goals, metrics
auditoria: audit_events (hash chain: previous_hash + hash)
ia:        ai_conversations, ai_messages, ai_actions
erp:       erp_integrations, erp_sync_events
```

Multi-tenancy: `org_id` em todas as entidades de negocio + RLS por `auth.jwt()` + trigger anti cross-tenant (padrao `SGA-P01`). `service_role` somente server-side (`SGA-D03`).

## 5. RBAC (matriz por perfil × modulo)

Papeis v1: `admin, gestor, solicitante/cliente, comprador, tecnico, estoque, auditor`.

```text
                 tickets  os     compras  estoque  arquivos  relatorios  config  auditoria
admin            full     full   full     full     full      full        full    read
gestor           full     full   aprovar  read     full      full        parcial read
tecnico          read*    exec** read-os  consumo  own-files  own         —       —
comprador        —        read   cotar    read     own-files  Compras     —       —
estoque          —        read   receber  full     own-files  Estoque     —       —
solicitante      own      own    own      —        own-files  own         —       —
auditor          read     read   read     read     read      full        —       full
```

`*` tecnico le tickets vinculados as suas OS. `**` transicoes de execucao/pausa/retomada/conclusao propria.
Regra dura: autorizacao no backend/database (RLS + checks server-side). Frontend esconde botao = UX, nunca seguranca.

## 6. Maquinas de estado (enums fechados — D-04)

```text
TICKET: NOVO → EM_TRIAGEM → EM_ANALISE → { CONVERTIDO | RESOLVIDO } → ENCERRADO
OS:     ABERTA → ATRIBUIDA → EM_EXECUCAO ⇄ PAUSADA → CONCLUIDA → VALIDACAO → ENCERRADA
COMPRA: SOLICITADA → EM_ANALISE → DESIGNADA → COTACAO → AGUARDANDO_APROVACAO
        → { APROVADA → NEGOCIACAO → PAGAMENTO → EM_TRANSITO → RECEBIDA → CONCLUIDA
          | REJEITADA (justificativa obrigatoria) | CANCELADA }
```

Transicoes via funcao pura `transition(entity, from, event)` em `domain/` + persistencia do evento em `*_events` + `audit_events`. Strings de status proibidas fora do enum.

## 7. SLA da OS (regra critica — deterministica e testavel)

- `domain/sla.ts`: `remainingMs(totalMs, executedMs, pauses[])` — pausa congela, nunca consome.
- `work_order_pauses`: `paused_at, resumed_at, reason, user_id, sla_before_ms, sla_after_ms, duration_ms`.
- Relogio: persistir UTC; apresentacao converte no client. Testes vitest cobrem: sem pausa, uma pausa, N pausas, pausa aberta (usa `now` injetavel).

## 8. Offline-first

```text
Online → sync normal | Offline → IndexedDB + outbox (op idempotente UUIDv7/client-generated)
→ reconexao → push ordenado → pull → conflito (last-write-wins por campo com vetor de versao; server vence em estoque/auditoria; duplicata descartada por idempotency_key)
```

UI mostra `ONLINE | OFFLINE | SINCRONIZANDO | PENDENCIAS(n) | ERRO`. Declarar offline concluido exige os 8 itens (armazenamento, fila, idempotencia, sync, estados, reconexao, conflito, feedback) — PWA instalavel sozinho nao conta.

## 9. BotIA (AIProvider — IA recomenda, humano decide)

```ts
interface AIProvider { triage(input): Promise<TriageResult>; classify(...); summarize(...); suggestMissing(...); }
```

- `DeterministicProvider` (regras, sem rede) = padrao/fallback; provedor LLM plugavel atras da interface.
- Proibido a IA: aprovar/rejeitar compra, aprovar pagamento, encerrar OS, mutar estoque critico, alterar permissoes.
- Toda acao relevante gera `ai_actions` + `audit_events`.

## 10. ERP (ERPAdapter — MOCK honesto)

```ts
interface ERPAdapter { status(): 'PENDENTE_DE_INTEGRACAO'|'MOCK'|'CONECTADO'; sync(...); }
```

Sem docs do ERP: somente interfaces + contratos + `MockERPAdapter` + `erp_sync_events` com erro tratado. Estado oficial: **ERP PENDENTE DE INTEGRACAO**. Nunca declarar "integrado".

## 11. Auditoria (hash chain)

`audit_events`: `seq, user_id, at, event, entity, entity_id, before, after, ip/device?, previous_hash, hash = HMAC-SHA256(previous_hash + payload canonico)`.
Correcao = novo evento compensatorio; nunca UPDATE/DELETE silencioso. Verificacao: `verifyChain()` em testes + job.

## 12. PDF / Notificacoes / Arquivos / Dashboard / Metas / Relatorios / Backup

- PDF server-side (ticket, OS+relatorio, solicitacao/pedido/cotacao, estoque/inventario/movimentacoes, auditoria, gerenciais) com cabecalho, numeracao, paginacao, versao, trilha de auditoria.
- Notificacoes: in-app + push + e-mail (+WhatsApp futuro). 16 eventos do plano + prefs por usuario.
- Arquivos: `files(owner_type, owner_id, folder, mime, size, hash, uploaded_by)`; Storage privado `o/{orgId}/...` + signed URL curta (`SGA-P02`).
- Dashboards por perfil (gestor/tecnico/comprador/estoque/cliente) sobre camada pura `calculations` + I/O separada (padrao `SGA-D04`).
- Metas configuraveis em `goals` (nunca hardcode).
- Backup completo = mecanismos oficiais do provedor (Supabase/Vercel); app expoe apenas exportacoes CSV/PDF honestas.

## 13. Gates de qualidade (por tarefa relevante)

```text
vitest focado → tsc --noEmit (0 erros) → eslint (0) → build → (quando houver backend live) teste de rota
```

## 14. Riscos / pendencias externas (nao inventar)

- Supabase: SEM credenciais → `BLOQUEADO POR DEPENDENCIA EXTERNA` ate `SUPABASE_URL + ANON_KEY (+ SERVICE_ROLE no server)`.
- GitHub remote, Vercel projeto/dominio, provedor IA/LLM, API ERP, SMTP/push, WhatsApp: todos NAO CONFIGURADO.
