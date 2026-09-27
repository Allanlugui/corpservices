export type IntegrationStatus =
  | "CONFIGURADO"
  | "NAO_CONFIGURADO"
  | "PENDENTE_DE_INTEGRACAO"
  | "MOCK";

export interface IntegrationInfo {
  name: string;
  status: IntegrationStatus;
  detail: string;
}

function has(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Mapa honesto do estado das integracoes. Sem credencial => NAO_CONFIGURADO, nunca "conectado". */
export function getIntegrations(
  env: Partial<Record<string, string | undefined>> = process.env,
): IntegrationInfo[] {
  const supabase =
    (has(env["SUPABASE_URL"]) || has(env["NEXT_PUBLIC_SUPABASE_URL"])) &&
    (has(env["SUPABASE_ANON_KEY"]) || has(env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]));
  return [
    {
      name: "Supabase (banco + auth)",
      status: supabase ? "CONFIGURADO" : "NAO_CONFIGURADO",
      detail: supabase
        ? "Variáveis presentes; conexao validada somente em runtime."
        : "Defina SUPABASE_URL e SUPABASE_ANON_KEY. Sem isso, persistencia remota indisponivel.",
    },
    {
      name: "ERP",
      status: "PENDENTE_DE_INTEGRACAO",
      detail: "Somente interfaces + MockERPAdapter. Aguardando documentacao oficial da API.",
    },
    {
      name: "Provedor IA (LLM)",
      status: "PENDENTE_DE_INTEGRACAO",
      detail: "BotIA opera em modo deterministico ate um provedor ser configurado.",
    },
    {
      name: "E-mail (Resend)",
      status: has(env["RESEND_API_KEY"]) ? "CONFIGURADO" : "NAO_CONFIGURADO",
      detail: has(env["RESEND_API_KEY"])
        ? "Chave presente; validade real só no envio (aba E-mail → teste)."
        : "Defina RESEND_API_KEY. Sem isso, a fila acumula e nada é enviado.",
    },
    {
      name: "Push (VAPID)",
      status: has(env["VAPID_PRIVATE_KEY"]) ? "CONFIGURADO" : "PENDENTE_DE_INTEGRACAO",
      detail: has(env["VAPID_PRIVATE_KEY"])
        ? "Chaves presentes; ative por dispositivo em Configurações → E-mail e push."
        : "Chaves VAPID ainda não geradas.",
    },
    {
      name: "WhatsApp",
      status: "PENDENTE_DE_INTEGRACAO",
      detail: "Previsto como canal futuro; fora do escopo das fases iniciais.",
    },
  ];
}
