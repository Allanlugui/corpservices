# Problemas e Limitacoes: corpservices

## Abertos
- **P-03 (2026-09-26):** Deploys via CLI entram em BLOCKED (`buildSkipped:true`, alias nao atribuido; docs apontam configuracao de colaboracao/protecao). Caminho canonico: conectar o repo GitHub ao projeto no dashboard (Import Git) para deploys automaticos por push. Fix `@types/node@24` ja commitado (3f7b243) resolve o erro de build anterior.
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- **P-01 (2026-09-26):** RESOLVIDO — repo privado `Allanlugui/corpservices` criado via `gh`, push OK.
- **P-07 (2026-09-26):** RESOLVIDO — migration aplicada (6 tabelas + RLS + 44 grants).
