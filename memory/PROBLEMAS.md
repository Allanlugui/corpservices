# Problemas e Limitacoes: corpservices

## Abertos
- (nenhum bloqueio; ver pendências P2–P4 no TODO)
- **P-09 (2026-09-27, re-auditoria do prompt original): NÃO VALIDADO — hash-chain só em `audit_events`; eventos de negócio (ticket/OS/compra) têm from/to + ator mas sem elo hash.** Para §22 integral, estender D-09 às 3 tabelas de eventos (Fase 29 proposta).
- **P-10 (2026-09-27): NÃO VALIDADO — relatórios sem filtros de departamento/categoria/fornecedor/produto/usuário (§29).** Entidade/período/status prontos; demais exigem colunas que nem sempre existem (ex: departamento no ticket).
- **P-11 (2026-09-27): NÃO VALIDADO — breakpoints §30 (1440→360) nunca medidos em device lab;** responsivo implementado (drawer, tabelas adaptadas) mas sem evidência por largura.
- **P-12 (2026-09-27): NÃO VALIDADO — E2E automatizado (§37) era script temporário removido;** cobertura atual é vitest de domínio (89). Playwright segue fora.
- **P-13 (2026-09-27): componentes §32 parcialmente ausentes** (Combobox, Switch, Modal dedicada, DateRangePicker, UserAvatar dedicada) — sem impacto funcional; criar sob demanda.
- **P-03 (2026-09-26):** RESOLVIDO — git conectado no dashboard; deploys automaticos por push; producao validada. Sub-notas: (a) deploys CLI entram em BLOCKED (usar git); (b) preview URLs exigem SSO Vercel; (c) `health` exigiu fallback NEXT_PUBLIC_* (fix e40dc29).
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- **P-08 (2026-09-26):** RESOLVIDO — app_settings aplicada (verificada via REST 200); settings CRUD validado em produção.
- **P-01 (2026-09-26):** RESOLVIDO — repo privado `Allanlugui/corpservices` criado via `gh`, push OK.
- **P-07 (2026-09-26):** RESOLVIDO — migration aplicada (6 tabelas + RLS + 44 grants).
