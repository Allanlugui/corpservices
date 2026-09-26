import { redirect } from "next/navigation";

/** Auditoria mora em Configurações (aba). Rota antiga redireciona. */
export default function AuditoriaRedirect() {
  redirect("/configuracoes?tab=auditoria");
}
