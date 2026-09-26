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
- [ ] 06.6 Push + producao + memoria final

## FASES 06–12 [PLANEJADAS — detalhadas apos Fase 05]
- [ ] 06 Compras (duas arvores) + cotacao/aprovacao/pagamento/recebimento
- [ ] 07 Estoque (CRUD, NF/XML tolerante, validade, metricas)
- [ ] 08 Arquivos (explorador por OS) + 09 Offline-first real + 10 BotIA LLM (opcional)
- [ ] 11 ERP real (quando houver docs) + 12 Notificacoes/Dashboard/Metas/PDF/Auditoria/Relatorios/Backup honesto

## Dependencias externas (BLOQUEADO POR DEPENDENCIA EXTERNA ate providas)
- [ ] Supabase URL + keys · GitHub remote · Vercel projeto · SMTP/push · provedor LLM · API ERP
