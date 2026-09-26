import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";

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
      <Card title="Módulo ainda não implementado">
        <p className="text-sm text-slate-600">
          Nenhum dado é exibido aqui porque o backend deste módulo não existe. Nada foi mockado
          como funcional. Acompanhe o progresso em <code>memory/TODO.md</code>.
        </p>
      </Card>
    </section>
  );
}
