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

## FASE 02 — Identidade, usuarios e permissoes [PLANEJADA]
- [ ] 02.1 Papeis + permissoes (8 papeis) + RLS por modulo/acao/entidade/estado
- [ ] 02.2 Testes de autorizacao backend (nao so esconder botao)

## FASE 03 — Tickets e triagem BotIA [PLANEJADA]
- [ ] 03.1 Portal publico + BotIA conversacional (DeterministicProvider) + anexos
- [ ] 03.2 Ticket → Chamados (Servicos/Compras) + link seguro por e-mail

## FASE 04 — Chamados [PLANEJADA]
- [ ] 04.1 Tela central + acoes do gestor (resolver/encaminhar/converter OS/compra)

## FASE 05 — Ordem de Servico [PLANEJADA]
- [ ] 05.1 Ciclo completo + pausas configuraveis + compra vinculada + SLA congelado (testes deterministicos)

## FASES 06–12 [PLANEJADAS — detalhadas apos Fase 05]
- [ ] 06 Compras (duas arvores) + cotacao/aprovacao/pagamento/recebimento
- [ ] 07 Estoque (CRUD, NF/XML tolerante, validade, metricas)
- [ ] 08 Arquivos (explorador por OS) + 09 Offline-first real + 10 BotIA LLM (opcional)
- [ ] 11 ERP real (quando houver docs) + 12 Notificacoes/Dashboard/Metas/PDF/Auditoria/Relatorios/Backup honesto

## Dependencias externas (BLOQUEADO POR DEPENDENCIA EXTERNA ate providas)
- [ ] Supabase URL + keys · GitHub remote · Vercel projeto · SMTP/push · provedor LLM · API ERP
