import Link from "next/link";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <section>
      <PageHeader title="Configurações" description="Administração e diagnóstico da plataforma." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Auditoria e logs (M-03)">
          <p className="text-sm text-slate-600">
            Trilha completa de eventos: chamados, OS, compras e estoque — com ator e data.
          </p>
          <Link href="/auditoria" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Abrir auditoria →
          </Link>
        </Card>
        <Card title="Saúde do sistema">
          <p className="text-sm text-slate-600">Estado das integrações e versão.</p>
          <Link href="/api/health" className="mt-2 inline-block font-mono text-sm font-semibold text-brand-700 hover:underline">
            /api/health
          </Link>
        </Card>
      </div>
      <div className="mt-4">
        <ModulePlaceholder
          title="Parâmetros"
          fase="FASE 12"
          description="Empresa, papéis, SLAs, motivos de pausa e templates. Gestão fina chega na Fase 12."
        />
      </div>
    </section>
  );
}
