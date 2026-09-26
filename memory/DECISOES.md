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

## D-13 — Next.js 16 via template oficial (2026-09-26, Fase 01)
- Contexto: `create-next-app@latest` entrega Next 16.3.6 + Tailwind v4 (D-01 previa v15).
- Escolha: aceitar a versao do template; dois ajustes manuais (`LayoutProps` removido → `ReactNode` explicito; `Badge` children `ReactNode`).
- Motivo: acompanhar o template reduz divergencia futura; nada do plano depende de v15 especifica.
- Reversao: baixa.
- Contexto: Vercel sem filesystem persistente; "backup completo" falso e proibido.
- Escolha: PDFs por stream/download; backup = mecanismos oficiais Supabase; app so exporta CSV/PDF.
- Reversao: baixa.
