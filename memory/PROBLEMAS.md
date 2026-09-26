# Problemas e Limitacoes: corpservices

## Abertos
- **P-01 (2026-09-26):** Sem repositorio git nem remote — `fatal: not a git repository`. Commit sera local; `push` BLOQUEADO ate `git remote` provido. Afeta: regra commit+push por tarefa.
- **P-02 (2026-09-26):** Sem credenciais Supabase (URL/keys). Migrations/Auth/RLS BLOQUEADOS POR DEPENDENCIA EXTERNA. Nada sera mockado como "conectado".
- **P-03 (2026-09-26):** Sem projeto Vercel/GitHub. Deploy/validacao de producao NAO CONFIGURADO.
- **P-04 (2026-09-26):** Serena MCP `get_current_config` → timeout `-32001`. Memoria local + global cobre continuidade; retentar ativacao na Fase 01. NAO VALIDADO.
- **P-05 (2026-09-26):** Sem docs do ERP, sem provedor LLM, sem SMTP/push. Estrategias definidas como interfaces + mocks honestos (D-07/D-08).
- **P-06 (2026-09-26):** `.bat` de bootstrap mencionado no plano nao encontrado no diretorio. Informativo — arquitetura nao depende dele.

## Resolvidos
- (nenhum ainda)
