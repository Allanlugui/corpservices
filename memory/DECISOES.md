# Decisoes Arquiteturais: corpservices

> Formato: decisao · contexto · alternativas · escolha · motivo · impacto · reversao.

## D-01 — Stack Next.js 15 + React 19 + TS strict + Tailwind + Supabase (2026-09-26, Fase 00)
- Contexto: projeto vazio; plano exige web/PWA corporativa com RLS, deploy Vercel.
- Alternativas: (a) T3/TanStack puro; (b) Firebase; (c) .NET backend separado.
- Escolha: Next.js App Router + Supabase Postgres + Vercel, padrao do ecossistema (`CENTRAL-CODIGO`).
- Motivo: RLS/RLS+trigger prontos, server/client boundaries conhecidos (`SGA-P03/P04`), deploy canonico.
- Impacto: estrutura `src/app + features + domain + infra`; gates `SGA-P09`.
- Reversao: media (troca de backend isolada atras de repositories/adapters).

## D-02 — Multi-tenancy `org_id` + RLS default-deny + trigger anti cross-tenant (2026-09-26, Fase 00)
- Contexto: RBAC por unidade/setor exigido; vazamento cross-tenant e o risco #1.
- Alternativas: (a) isolamento so no app; (b) schema por tenant.
- Escolha: padrao `SGA-P01/SGA-D02`: dupla barreira app + RLS + trigger `enforce_same_org`; tenant derivado server-side via JWT+membership (`SGA-D01`); `service_role` server-only (`SGA-D03`).
- Impacto: toda entidade de negocio carrega `org_id`; Storage `o/{orgId}/...` (`SGA-P02`).
- Reversao: baixa (aditivo por migration).

## D-03 — Feature-sliced + `domain/` puro (2026-09-26, Fase 00)
- Contexto: 13+ modulos; evitar monolito de `utils/` e logica na UI.
- Alternativas: (a) camadas Clean rigidas; (b) tudo em `app/`.
- Escolha: `features/<f>/{schema,service,repository,...}` + `domain/` puro (estados, SLA) + `infra/` (adapters).
- Motivo: regra de negocio testavel sem I/O; integracoes substituiveis (`padroes-codigo.md` §36).
- Reversao: alta (estrutural) — nao reverter sem motivo forte.

## D-04 — State machines explicitas + eventos (2026-09-26, Fase 00)
- Contexto: plano proibe strings de status espalhadas; auditoria exige trilha.
- Escolha: enums fechados + `transition()` pura + tabelas `*_events`; estados do plano (§25) como v1.
- Impacto: UI so dispara eventos; backend valida transicao.
- Reversao: media.

## D-05 — SLA deterministico com `now` injetavel (2026-09-26, Fase 00)
- Contexto: "nao consumir SLA em pausa" deve ser testavel, nao visual.
- Escolha: `domain/sla.ts` puro + `work_order_pauses` com `sla_before/after`; UTC persistido.
- Reversao: baixa.

## D-06 — Duas arvores de compra, uma infra (2026-09-26, Fase 00)
- Contexto: compra-cliente vs compra-OS nao podem se misturar, mas compartilham cotacao/aprovacao.
- Escolha: `purchase_requests` + `purchase_request_links(origin, ticket_id?, work_order_id?)`; OS↔compra persistente e notificacao tecnico no recebimento.
- Reversao: media.

## D-07 — AIProvider com Deterministic default (2026-09-26, Fase 00)
- Contexto: sem provedor LLM configurado; IA nao pode decidir.
- Escolha: interface + `DeterministicProvider` padrao; LLM futuro atras da interface; acoes em `ai_actions`; veto a acoes administrativas.
- Reversao: baixa.

## D-08 — ERPAdapter MOCK honesto (2026-09-26, Fase 00)
- Contexto: sem docs do ERP.
- Escolha: somente interface + contratos + mock + `erp_sync_events`; estado `PENDENTE_DE_INTEGRACAO`.
- Reversao: baixa (implementar adapter real na camada).

## D-09 — Auditoria hash-chain, append-only (2026-09-26, Fase 00)
- Contexto: detectar alteracao posterior do historico; nao confundir com ICP-Brasil.
- Escolha: `audit_events` com `previous_hash/hash`, correcao por evento compensatorio, `verifyChain()`.
- Reversao: alta (contrato de confianca).

## D-10 — Offline com outbox idempotente (2026-09-26, Fase 00)
- Contexto: conectividade instavel em campo.
- Escolha: IndexedDB + outbox `idempotency_key` + server vence em estoque/auditoria; status de sync explicito na UI.
- Reversao: media.

## D-11 — Entrada de estoque tolerante + `cadastro_incompleto` (2026-09-26, Fase 00)
- Contexto: NF/XML pode vir sem campos opcionais.
- Escolha: nunca bloquear; marcar pendencia e notificar responsavel de estoque.
- Reversao: baixa.

## D-12 — PDF server-side, backup via provedor (2026-09-26, Fase 00)
- Contexto: Vercel sem filesystem persistente; "backup completo" falso e proibido.
- Escolha: PDFs por stream/download; backup = mecanismos oficiais Supabase; app so exporta CSV/PDF.
- Reversao: baixa.

## D-13 — Next.js 16 via template oficial (2026-09-26, Fase 01)
- Contexto: `create-next-app@latest` entrega Next 16.3.6 + Tailwind v4 (D-01 previa v15).
- Escolha: aceitar a versao do template; dois ajustes manuais (`LayoutProps` removido → `ReactNode` explicito; `Badge` children `ReactNode`).
- Motivo: acompanhar o template reduz divergencia futura; nada do plano depende de v15 especifica.
- Reversao: baixa.

## D-14 — AppShell + route groups + case-sensitivity (2026-09-26, correção UI/UX)
- Contexto: conteúdo comprimido, sem sidebar, portal público vendo navegação interna, dashboard estático.
- Escolha: `(public)` (login, solicitar) × `(app)` (AppShell: Sidebar + Header + main max-w-7xl); sidebar filtrada por `can(role)`; dashboard com KPIs reais de `/api/dashboard`; 20 primitivas de design system sem nova lib visual além de `lucide-react`.
- Incidente: imports `@/components/ui/badge` vs arquivo `Badge.tsx` quebraram o build no Linux (case-sensitive). Fix: rename para minúsculas; padrão: arquivos sempre minúsculos.
- Reversao: baixa (só apresentação; APIs e banco intactos).

## D-15 — RETOMADA como evento, não status (2026-09-26, Fase 05)
- Contexto: plano §25 lista RETOMADA entre estados; status persistido duplicaria EM_EXECUCAO e complicaria o SLA.
- Escolha: transição PAUSADA→EM_EXECUCAO com evento RETOMADA (duração e SLA registrados na pausa).
- Reversao: baixa.

## D-16 — Recebimento avisa a OS; retomada é do técnico (2026-09-26, Fase 06)
- Contexto: plano exige notificação e retorno da OS ao receber componente.
- Escolha: RECEBIDA gera `COMPONENTE_RECEBIDO` na OS (+pedido RECEBIDO); técnico retoma manualmente (SLA segue congelado até lá). Sem tabela de notificações ainda (Fase 12).
- Reversao: baixa.

## D-17 — Cotar é operacional, escolher é do gestor (2026-09-26, revisão)
- Contexto: quem cadastra fornecedor vs quem decide.
- Escolha: `purchases:update` (comprador, estoque, técnico, gestor) cadastra cotações; `purchases:approve` (gestor, admin) escolhe a vencedora e aprova/rejeita.
- Reversao: baixa.

## D-18 — Foto obrigatória sem bloqueio até a Fase 08 (2026-09-26, revisão)
- Contexto: checklist pode exigir registro fotográfico, mas Storage com RLS só chega na Fase 08.
- Escolha: flag `requires_photo` registrada e exibida; sem bloqueio de conclusão até o upload existir.
- Reversao: baixa.

## D-19 — Saldo nunca negativo (2026-09-26, Fase 07)
- Contexto: saída sem saldo corromperia o estoque.
- Escolha: `applyMovement` puro + bloqueio 422 no servidor; ajuste define saldo (auditável).
- Reversao: baixa.

## D-20 — Storage sem acesso direto + upload operacional (2026-09-26, Fase 08)
- Contexto: fotos de campo por técnico/estoque sem vazar entre orgs.
- Escolha: bucket privado sem policies diretas (default deny) + signed URLs via servidor; upload operacional (files:create), exclusão só gestor/admin.
- Reversao: baixa.

## D-21 — Backup como export honesto (2026-09-26, ajustes2)
- Contexto: migração futura para MongoDB/MariaDB/outros.
- Escolha: export JSON (dados + mapa de coleções + restore_notes) somente admin; DDL canônico nas migrations; sem replicação ao vivo.
- Reversao: baixa.

## D-22 — PDF com pdf-lib + Metas mensais (2026-09-26)
- Contexto: documento elegante sem infra de render; metas nunca hardcoded.
- Escolha: faixa de marca, tabelas zebra, rodapé paginado, sanitização WinAnsi; goals com 4 métricas e progresso no mês.
- Reversao: baixa.

## D-24 — Paginação server-side (2026-09-26)
- Contexto: listas com limit fixo não escalam.
- Escolha: helper pageParams + count exact + range; busca server-side; UI com debounce e totais.
- Reversao: baixa.

## D-23 — Fechamento Fase 12: dashboards por perfil + parâmetros consumidos + assignment (2026-09-26)
- Contexto: auditoria P1-01/P1-02/P2.
- Escolha: 5 visões reaproveitando endpoints; 3 parâmetros com consumidor real + auditoria; assertAssigneeInOrg puro + checagem nas rotas.
- Divergência auditoria: entrada-xml legada MANTIDA (decisão humana pendente, item 5).
- Reversao: baixa.
