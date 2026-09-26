# Status do Projeto: corpservices

- **Data:** 2026-09-26
- **Fase atual:** FASE 00 — Descoberta, auditoria e arquitetura (planejamento CONCLUIDO, commit pendente, aval humano pendente)
- **Estado real do repo:** vazio — apenas `AGENTS.md` + `memory/`; sem codigo, sem git, sem dependencias, sem `.env`, sem Supabase/Vercel/GitHub.
- **Entregue nesta sessao:** `ARCHITECTURE.md` (stack, modulos, dados, RBAC, estados, SLA, offline, BotIA, ERP, auditoria), `DECISOES.md` (D-01…D-12), `TODO.md` (backlog por fases), `PROBLEMAS.md`, `HISTORICO.md`.
- **Validado:** leitura do cerebro global/local + Subconsciente; auditoria factual (Node v24.13.0, npm 11.6.2, `not a git repository`).
- **Nao validado:** Serena (`get_current_config` timeout MCP -32001); todo o resto e PLANEJADO, nada IMPLEMENTADO.
## FASE 02 — Identidade, usuarios e permissoes (PARCIAL, 2026-09-26)
- Auth funcional: middleware sessao + `/login` + `/api/logout`; rota protegida redireciona (`/os` → 307 `/login?next=/os` VALIDADO).
- Clients: `supabase-browser` (anon) + `supabase-server` (anon+cookies) + `supabase-admin` (service_role, server-only, fail-closed).
- RBAC: `src/domain/rbac.ts` (7 papeis × 8 modulos, fail-closed) + 5 testes.
- Migration v1 (`supabase/migrations/20260926000000_identity_v1.sql`): organizations, departments, app_roles, app_permissions, role_permissions, profiles + RLS default-deny + seeds. **APLICADA E VALIDADA 2026-09-26** (6 tabelas, RLS nas 6, 44 grants; REST anon `profiles` → 200 `[]`).
- Gates: vitest 10/10 · tsc 0 · lint 0 · build OK · health Supabase=CONFIGURADO · `/login` 200.
- Proximo: (a) trocar senha temporaria do admin, (b) token Vercel para deploy (P-03), (c) AVAL → FASE 03.
- **GitHub:** repo privado `Allanlugui/corpservices`, branch master, push OK (4 commits).
- **Vercel:** projeto `corpservices` (git Allanlugui/corpservices) com deploy automatico; PRODUCAO VALIDADA em `https://corpservices.vercel.app` (health 200 Supabase=CONFIGURADO, /login 200, `/` → 307 /login). Nota: URLs de preview exigem login Vercel (Deployment Protection); alias de producao e publico.
## FASE 04 — Chamados (CONCLUIDA, 2026-09-26)
- `requireProfile()` server-side (sessao + papel, fail-closed) + APIs GET listar/filtrar, GET detalhe, PATCH transicao/conversao com `ticket_events`.
- UI `/chamados` (tabs Todos/Servicos/Compras) + `/chamados/[id]` (dados, sugestoes IA, acoes, historico).
- Conversao registra destino + modulo pendente (OS→Fase 05, compra→Fase 06); nada fingido como criado.
- E2E autenticado: LIST 200 (n=2) → PATCH NOVO→EM_TRIAGEM 200 → detalhe + eventos CRIADO,ALTERADO.
- Producao: `/chamados` OK; API sem auth → 307 /login.
## FASE 03 — Tickets e triagem BotIA (CONCLUIDA, 2026-09-26)
- Migration v2 aplicada: tickets, ticket_messages, ticket_attachments, ticket_events, ai_conversations, ai_messages, ai_actions + RPC `get_ticket_by_token`.
- BotIA: `AIProvider` + `DeterministicProvider` (classifica, aponta faltantes, nunca sobrescreve humano em empate); trilha auditavel por solicitacao.
- Portal `/solicitar` (publico, mobile-first, 5 etapas) + `/solicitar/acompanhar` (token) + APIs POST/GET.
- E2E local: ticket #3 criado → triagem servico → evento CRIADO → acompanhar retorna protocolo+historico.
- RLS: anon select externo → 200 `[]` (sem vazamento); leitura publica somente via RPC com token.
- Producao: `/solicitar` 200 OK. Pendente conhecido: upload de fotos → FASE 08; e-mail do link → sem SMTP (P-05).
- **Git:** commit local `cac928c` OK; `push` BLOQUEADO (sem remote — P-01); Vercel NAO CONFIGURADO (P-03).

## FASE 01 — Fundacao tecnica (CONCLUIDA local, 2026-09-26)
- Scaffold: Next.js **16.3.6** (template atual; D-01 ajustada) + React 19 + TS strict + Tailwind v4 + ESLint 9 + vitest 5.
- App navegavel: `/` dashboard factual + 7 modulos com placeholder honesto (PENDENTE, sem fake) + `/api/health` `{data}/{error}`.
- Design system inicial: `PageHeader, StatCard, EmptyState, Badge` + `AppNav` (pt-BR) + PWA PARCIAL (manifest + SW ciclo-de-vida; cache offline = FASE 09).
- Supabase: `src/lib/supabase.ts` fail-closed (`SupabaseNotConfiguredError`); `.env.example`; conexao real BLOQUEADA (P-02).
- Gates: vitest 5/5 · tsc 0 · lint 0 · build OK · 9 rotas 200 em `next start` (porta 3101).

## CORREÇÃO UI/UX (CONCLUIDA, 2026-09-26)
- ANTES: topbar única, sem sidebar, portal público vendo navegação interna, dashboard estático Fase 01, 4 primitivas, sem filtros/paginação/toast/skeleton, sem indicador offline, sem RBAC na navegação.
- DEPOIS: AppShell (sidebar colapsável + drawer mobile + header com breadcrumb, sync e UserMenu), route groups (public)/(app), 20 primitivas, dashboard com KPIs reais, Chamados com FilterBar+DataTable+paginação, detalhe com Tabs+Timeline+ConfirmDialog+toast, sidebar filtrada por papel, indicador ONLINE/OFFLINE real, skip-link e foco visível.
- Incidente: `Badge.tsx` vs `badge` quebrou build Linux → padrão minúsculas (D-14).
- Produção validada com sessão real (dashboard novo no ar).

## FASE 06 — Compras (CONCLUIDA, 2026-09-26)
- Migration v4 (5 tabelas, origem com CHECK) + domínio + 28 testes.
- APIs: criar por ticket/OS/manual, 13 transições, cotar/escolher, aprovação só gestor, pedido auto na aprovação, RECEBIDA → COMPONENTE_RECEBIDO na OS, rejeição → COMPRA_REJEITADA (OS segue pausada).
- UI /compras + detalhe 4 abas + criação a partir do ticket e da OS pausada.
- E2E: árvore A CONCLUIDA (12 eventos, 1 pedido) · árvore B rejeição→reenvio→aprovação→recebimento→OS retomada e ENCERRADA.
- Producao: API 200 (n=4) + UI nova no ar. FASE 06 CONCLUIDA.

## FASE 07 — Estoque (CONCLUIDA, 2026-09-26)
- Migration v6 (5 tabelas) + domínio + 34 testes.
- APIs: produtos CRUD, movimentos com trava de saldo, entrada XML NF-e tolerante, alertas (6 tipos), métricas por período, fornecedores.
- UI /estoque (alertas, filtros, métricas) + /estoque/novo (manual + XML) + detalhe 4 abas + /fornecedores.
- E2E: entrada/saída/bloqueio/XML/alertas/métricas OK · produção API 200 n=3.
- D-19: saída sem saldo bloqueia no servidor (nunca negativo).

## AJUSTES DASHBOARD/TABELAS/ESTOQUE (CONCLUIDO, 2026-09-26)
- Dashboard real (OS + compras, sem placeholders de fase).
- Linha inteira clicável nas 4 tabelas (mouse + teclado).
- CRUD produto completo (aba Editar espelho, 18 campos, NCM/peso, pendência recalculada).
- XML por arquivo + fornecedor auto (nome + CNPJ) + lote em massa.
- E2E ajustes OK · deploy READY.

## PONTAS SOLTAS — auditoria honesta (2026-09-26)
Feito (validado): Fases 00–07, correção UX, 2 revisões. Pendente real:
- FASE 08 Arquivos: upload real (Storage+RLS), explorador por OS, foto do checklist.
- FASE 09 Offline: só indicador; falta fila/outbox/sync.
- FASE 10 BotIA LLM: só determinístico.
- FASE 11 ERP: pendente de docs.
- FASE 12: notificações, metas, PDF, auditoria hash-chain, relatórios export, backup honesto, dashboards por perfil (só há 1), área de configurações (motivos, SLAs).
- E-mail/push: sem provedor (P-05).

## AJUSTE COMPRAS VIEWS (CONCLUIDO, 2026-09-26)
- Solicitações: coluna Item (primeiro item + contador).
- Cotações: agrupadas por compra + filtros (nº, fornecedor, escolhida/cotada).
- Pedidos: filtro por situação (aberto/pago/recebido/cancelado) + status da solicitação.
- E2E views OK · deploy READY.

## REVISÃO CHAMADOS/OS/COMPRAS (CONCLUIDA, 2026-09-26)
- Rastreabilidade: timelines mostram "por {nome}" (actors via profiles+Auth); rejeição exibe autor.
- Chamados: designar/remover responsável (/api/team), voltar EM_ANALISE→EM_TRIAGEM.
- OS: OS filha (parent_id) bloqueia concluir/validar/encerrar da pai (422); materiais exigem justificativa; checklist com flag foto obrigatória (upload na Fase 08, sem bloqueio agora); pausas com ações na própria aba.
- Compras: submenu vira filtro (Solicitações/Cotações/Pedidos, API views); escolher cotação exige gestor (D-17); detalhe mostra origem legível (OS-000002 · título).
- E2E: 9 verificações SIM · 29 testes · produção (views 200, team 200).
- Fica p/ depois (confirmado): upload de fotos (Fase 08), e-mail/push (P-05).

## FASE 05 — Ordem de Serviço (CONCLUIDA, 2026-09-26)
- [x] 05.1 Migration v3 aplicada (work_orders, pause_reasons + 8 seeds, pauses, checklists, materials, events)
- [x] 05.2 Domain: estados + SLA deterministico + 25 testes verdes
- [x] 05.3 APIs (criar de ticket CONVERTIDO, 8 transicoes, pausas com SLA, checklist, materiais)
- [x] 05.4 UI /os (tabela + SLA) + /os/[id] (4 abas + timeline + pausas)
- [x] 05.5 E2E ciclo completo: OS #1 ticket#4 → ENCERRADA, 8 eventos, pausa 7781ms, SLA congelado SIM
- Falta: commit/push/prod desta etapa + compra vinculada a OS (aguarda Fase 06).
- Producao: API /api/os 200 (n=1) + /os com UI nova no ar. FASE 05 CONCLUIDA.

## FASE 08 � Arquivos (CONCLUIDA, 2026-09-26)
- Migration v8 (bucket privado sem acesso direto + files) + APIs upload/lista signed-URL/remove.
- Explorador /arquivos (OS + pastas + filtro) + aba Arquivos na OS + foto por item de checklist.
- Enforcement: concluir OS exige foto em item done+requires_photo (422).
- M-01 preview + M-02 dedupe (barcode/nome, fornecedor exibido) + confirm em lote.
- RBAC: files:create p/ todos operacionais; delete s� gestor/admin (D-20).
- E2E: bloqueio, upload, signed, preview+unifica��o OK � prod xml-preview 200 + /arquivos no ar.

## FASE 09 � Offline-first v1 (CONCLUIDA, 2026-09-26)
- Migration v9 (client_key em tickets + eventos, unique+indices).
- Outbox localStorage + chaves UUID + sync engine (servidor vence, replay idempotente).
- Portal cria na fila offline; acoes Chamados/OS enfileiram; header com PENDENTES + sincronizar.
- E2E: reenvio nao duplica (ticket #12, evento unico) � 38 testes � deploy READY.
- Limite honesto: fila de operacoes (fotos offline e sync bidirecional completo ficam p/ evolucao).
