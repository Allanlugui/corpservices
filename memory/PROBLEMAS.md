# Problemas e Limitacoes: corpservices

## Abertos
- **P-08 (2026-09-26):** Migration `20260926000012_settings_v1.sql` (tabela app_settings) NÃO APLICADA — DNS direto `db.*.supabase.co` e pooler indisponíveis nesta sessão; API /api/configuracoes opera em fallback (defaults) e PATCH retorna DB_ERROR honesto. Desbloqueio: colar o arquivo no Dashboard > SQL Editor > Run. BLOQUEADO POR DEPENDÊNCIA EXTERNA (rede), não por decisão.
- **P-03 (2026-09-26):** RESOLVIDO — git conectado no dashboard; deploys automaticos por push; producao validada. Sub-notas: (a) deploys CLI entram em BLOCKED (usar git); (b) preview URLs exigem SSO Vercel; (c) `health` exigiu fallback NEXT_PUBLIC_* (fix e40dc29).
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- **P-01 (2026-09-26):** RESOLVIDO — repo privado `Allanlugui/corpservices` criado via `gh`, push OK.
- **P-07 (2026-09-26):** RESOLVIDO — migration aplicada (6 tabelas + RLS + 44 grants).
