# Tarefas: corpservices (backlog oficial — plano mestre)

> Fonte: prompt mestre do usuario (43 secoes). Fase 00 = planejamento/auditoria/arquitetura.
> Regra: concluir fase → atualizar memoria → PARAR e aguardar aval (regras-agente §26).

## FASE 00 — Descoberta, auditoria e arquitetura [EM ANDAMENTO]
- [x] 00.1 Auditar projeto (vazio: so AGENTS.md + memory/; sem git, sem codigo, sem .env)
- [x] 00.2 Ler cerebro global + local + Subconsciente
- [x] 00.3 Arquitetura tecnica (ARCHITECTURE.md)
- [x] 00.4 Modelo de dados nucleo v1
- [x] 00.5 Maquinas de estado v1
- [x] 00.6 RBAC v1
- [x] 00.7 Estrategia offline / BotIA / ERP / auditoria / PDF / notificacoes
- [ ] 00.8 Commit local (sem remote — push pendente)
- [ ] 00.9 AVAL HUMANO para encerrar Fase 00 e autorizar Fase 01

## FASE 01 — Fundacao tecnica [CONCLUIDA local]
- [x] 01.1 Scaffold Next.js + TS strict + Tailwind + ESLint + vitest
- [x] 01.2 PWA (manifest + SW ciclo-de-vida) + layout + navegacao + design system + health + dashboard factual
- [x] 01.3 Supabase estrutura plugavel fail-closed (conexao real BLOQUEADA sem credenciais — P-02)
- [x] 01.4 Gates verdes (5/5, tsc 0, lint 0, build OK, 9 rotas 200) + commit local
- [ ] 01.5 AVAL HUMANO para encerrar Fase 01 e autorizar Fase 02

## FASE 02 — Identidade, usuarios e permissoes [PARCIAL — falta apply da migration]
- [x] 02.1 Segredos em `.env.local` + Auth GoTrue VALIDADA
- [x] 02.2 Clients + middleware + login/logout (redirect 307 VALIDADO)
- [x] 02.3 RBAC domain + testes (10/10)
- [x] 02.4 Migration v1 escrita (RLS + seeds)
- [x] 02.5 Migration v1 APLICADA via psql-direto (pg) e validada (P-07 resolvido)
- [x] 02.6 Usuario admin criado (org CorpServices + role admin, login testado OK)
- [x] 02.7 GitHub: repo privado + push OK
- [x] 02.8 Vercel deploy + PRODUCAO VALIDADA (P-03 resolvido)
- [x] 02.9 FASE 02 encerrada → FASE 03 liberada

## FASE 03 — Tickets e triagem BotIA [CONCLUIDA 2026-09-26]
- [x] 03.1 Migration v2 aplicada (tickets + ai_* + RPC tracking)
- [x] 03.2 Estados + DeterministicProvider + testes (17/17)
- [x] 03.3 APIs POST /api/tickets + GET acompanhar
- [x] 03.4 Portal /solicitar + /solicitar/acompanhar
- [x] 03.5 E2E local + producao validada + push
- Notas: upload de fotos → FASE 08; e-mail do link → P-05 (sem SMTP)

## FASE 04 — Chamados [CONCLUIDA 2026-09-26]
- [x] 04.1 requireProfile + APIs listar/detalhe/transicao
- [x] 04.2 UI tabs + detalhe com acoes
- [x] 04.3 E2E autenticado (LIST/PATCH/eventos)
- [x] 04.4 Gates + push + producao

## CORREÇÃO UI/UX [CONCLUIDA 2026-09-26]
- [x] UX.1–UX.6 (auditoria, AppShell, design system, migração, RBAC/responsivo, gates+prod)

## FASE 05 — Ordem de Servico [CONCLUIDA 2026-09-26]
- [x] 05.1 Migration v3 aplicada (6 tabelas + 8 motivos)
- [x] 05.2 Domain: estados OS + SLA deterministico + testes (25/25)
- [x] 05.3 APIs OS completas
- [x] 05.4 UI /os + /os/[id]
- [x] 05.5 E2E ciclo completo validado (SLA congelado SIM)
- [x] 05.6 Push + producao + memoria final
- Nota: compra vinculada a OS (pausa por falta de componente) chega na FASE 06.

## FASE 06 — Compras [CONCLUIDA 2026-09-26]
- [x] 06.1 Migration v4 aplicada (5 tabelas, origem com CHECK)
- [x] 06.2 Domain purchase-states + testes (28/28)
- [x] 06.3 APIs (ciclo, cotacoes, recebimento + evento OS)
- [x] 06.4 UI /compras + detalhe 4 abas + botoes de origem
- [x] 06.5 E2E duas arvores validado
- [x] 06.6 Push + producao + memoria final

## REVISÃO CHAMADOS/OS/COMPRAS [CONCLUIDA 2026-09-26]
- [x] R1 Migration v5 (assigned_to, justification, requires_photo, parent)
- [x] R2 Atores no historico (actor_name nas 3 timelines)
- [x] R3 Chamados: designar + voltar EM_ANALISE→EM_TRIAGEM
- [x] R4 OS filha + bloqueio, materiais, foto flag, pausas UX
- [x] R5 Compras views + regra gestor + origem legivel
- [x] R6 E2E 9 verificações + prod

## FASE 07 — Estoque [CONCLUIDA 2026-09-26]
- [x] 07.1 Migration v6 aplicada (5 tabelas)
- [x] 07.2 Domain + testes (34/34)
- [x] 07.3 APIs (produtos, movimentos, XML, alertas, metricas, fornecedores)
- [x] 07.4 UI /estoque + novo + detalhe + fornecedores
- [x] 07.5 E2E + prod validados

## AJUSTES DASHBOARD/TABELAS/ESTOQUE [CONCLUIDO 2026-09-26]
- [x] D1 Dashboard real OS/compras
- [x] D2 Linha clicavel nas 4 tabelas
- [x] D3 CRUD produto + NCM/peso + form espelho
- [x] D4 XML por arquivo + fornecedor auto
- [x] D5 Gates + E2E + prod + pontas soltas auditadas

## FASE 08 — Arquivos [PROXIMA]
- [ ] Storage bucket + RLS + explorador por OS + foto do checklist
- [ ] M-01 Revisão de XML antes de lançar: escolher arquivo → extrair itens → tela de revisão editável (corrige campos) → lançamento em lote de uma vez
- [ ] M-02 Deduplicação no XML: cruzar referências (nome, barras, SKU, fornecedor) → perguntar "é o mesmo produto?" → se sim, só movimenta quantidade + histórico (data, ator, NF); se não, cria novo

## FASES 09–12 [PLANEJADAS]
- [ ] 09 Offline-first real (fila/outbox/sync — hoje só indicador)
- [ ] 10 BotIA LLM (hoje só determinístico)
- [ ] 11 ERP real (quando houver docs)
- [ ] 12 Notificações + Metas + PDF + Auditoria hash-chain + Relatórios export + Backup honesto + dashboards por perfil + configurações
- [ ] M-03 Auditoria/logs no front (Configurações): extrair logs do sistema p/ diagnóstico e correções

## Dependencias externas (BLOQUEADO POR DEPENDENCIA EXTERNA ate providas)
- [ ] Supabase URL + keys · GitHub remote · Vercel projeto · SMTP/push · provedor LLM · API ERP
