# Problemas e Limitacoes: corpservices

## Abertos
- **P-01 (2026-09-26):** Sem repositorio git nem remote — `fatal: not a git repository`. Commit sera local; `push` BLOQUEADO ate `git remote` provido. Afeta: regra commit+push por tarefa.
- **P-07 (2026-09-26):** Migration v1 escrita mas NAO APLICADA — sem senha do banco nem token de management API; postgREST nao executa DDL. Desbloqueio: (a) colar `supabase/migrations/20260926000000_identity_v1.sql` no Dashboard > SQL Editor > Run, ou (b) enviar `postgres://postgres:[senha]@db.hglxmpuvuqrdtsmmwrxf.supabase.co:5432/postgres` para apply via psql.
- **P-02 (2026-09-26):** PARCIALMENTE RESOLVIDO — Auth/REST acessiveis via anon key; persistencia de identidade aguarda P-07.
- **P-03 (2026-09-26):** Sem projeto Vercel/GitHub. Deploy/validacao de producao NAO CONFIGURADO.
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- (nenhum ainda)
