# Templates de e-mail do Supabase Auth — CorpServices (pt-BR)

> 12 modelos prontos em `supabase/email-templates/*.html`.
> Links externos (`EXTERNAL`) apontam para `https://corpservices.vercel.app`
> em vez das páginas padrão do Supabase.

## Como instalar (dashboard Supabase, 5 min)

1. Abra o projeto → **Authentication → Email Templates**.
2. Para cada item abaixo, abra o HTML correspondente, copie o conteúdo
   e cole no editor do template de mesmo nome. Salve.
3. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://corpservices.vercel.app`
   - **Redirect URLs:** adicione `https://corpservices.vercel.app/**`
4. Em **Authentication → Email → SMTP Settings** (opcional, recomendado):
   configure o SMTP próprio; sem isso os envios usam o remetente padrão
   do Supabase com limite baixo.

## Mapa (arquivo → template do dashboard → link)

| Arquivo | Template | Link usado |
|---|---|---|
| `confirm-signup.html` | Confirm sign up | `{{ .ConfirmationURL }}` (redireciona ao Site URL) |
| `invite-user.html` | Invite user | `{{ .ConfirmationURL }}` |
| `magic-link.html` | Magic link | `{{ .ConfirmationURL }}` |
| `change-email.html` | Change email address | `{{ .ConfirmationURL }}` |
| `reset-password.html` | Reset password | `https://corpservices.vercel.app/atualizar-senha?token_hash={{ .TokenHash }}&type=recovery` |
| `reauthentication.html` | Reauthentication | `{{ .ConfirmationURL }}` |
| `password-changed.html` | Password changed | `https://corpservices.vercel.app/login` |
| `email-changed.html` | Email address changed | `https://corpservices.vercel.app/login` |
| `phone-changed.html` | Phone number changed | `https://corpservices.vercel.app/login` |
| `signin-linked.html` | Sign-in method linked | `https://corpservices.vercel.app/login` |
| `signin-removed.html` | Sign-in method removed | `https://corpservices.vercel.app/login` |
| `mfa-added.html` | MFA method added | `https://corpservices.vercel.app/login` |
| `mfa-removed.html` | MFA method removed | `https://corpservices.vercel.app/login` |

## Nota honesta

Hoje **nenhum fluxo do código dispara e-mail nativo do Supabase**:
convites e resets saem pela nossa fila (SMTP Gmail) com links próprios.
Estes templates cobrem qualquer emissão nativa futura ou residual.
Verificação: `grep resetPasswordForEmail|signUp(|inviteUserById` em `src/` = zero.
