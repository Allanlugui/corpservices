# Problemas e Limitacoes: corpservices

## Abertos
- **P-01 (2026-09-26):** Sem repositorio git nem remote — `fatal: not a git repository`. Commit sera local; `push` BLOQUEADO ate `git remote` provido. Afeta: regra commit+push por tarefa.
- **P-07 (2026-09-26):** RESOLVIDO — migration aplicada via `pg` (psql ausente no host) com senha provida pelo usuario; verificadas 6 tabelas + RLS + 44 grants + REST anon 200 `[]`. Senha usada somente em variavel de ambiente transiente, nunca persistida em arquivo ou git.
- **P-02 (2026-09-26):** PARCIALMENTE RESOLVIDO — Auth/REST acessiveis via anon key; persistencia de identidade aguarda P-07.
- **P-03 (2026-09-26):** Sem projeto Vercel/GitHub. Deploy/validacao de producao NAO CONFIGURADO.
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- (nenhum ainda)
