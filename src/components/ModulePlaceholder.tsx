import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

export function ModulePlaceholder({
  title,
  fase,
  description,
}: {
  title: string;
  fase: string;
  description: string;
}) {
  return (
    <section>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge tone="pending">PENDENTE · {fase}</Badge>}
      />
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p className="text-base font-semibold">Módulo ainda não implementado</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Nenhum dado é exibido aqui porque o backend deste módulo não existe. Nada foi mockado
          como funcional. Acompanhe o progresso em <code>memory/TODO.md</code>.
        </p>
      </div>
    </section>
  );
}
