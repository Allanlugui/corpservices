"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { FileList, FileUploader, useFiles } from "@/components/files";

interface Wo {
  id: string;
  number: number;
  title: string;
}

/** Explorador documental por OS: Antes / Durante / Depois / Documentos. */
export default function ArquivosPage() {
  const [orders, setOrders] = useState<Wo[]>([]);
  const [osId, setOsId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/os")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) setError(json.error?.message ?? "Falha ao carregar.");
        else {
          const list = json.data.work_orders as Wo[];
          setOrders(list);
          if (list.length > 0) setOsId(list[0].id);
        }
      })
      .catch(() => setError("Falha de rede."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(
    (w) => !search.trim() || String(w.number).includes(search.trim()) || w.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const current = orders.find((w) => w.id === osId);

  return (
    <section>
      <PageHeader title="Arquivos" description="Explorador documental por ordem de serviço." />
      {loading ? (
        <LoadingState label="Carregando ordens…" />
      ) : error ? (
        <ErrorState title="Não foi possível carregar" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Ordens de Serviço" className="lg:col-span-1">
            <Input label="Buscar OS" value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="mt-2 grid max-h-96 gap-1 overflow-y-auto">
              {filtered.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setOsId(w.id)}
                    aria-current={w.id === osId ? "true" : undefined}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${w.id === osId ? "bg-slate-900 font-semibold text-white" : "hover:bg-slate-100"}`}
                  >
                    <span className="font-mono">OS-{String(w.number).padStart(6, "0")}</span> · {w.title}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-4 lg:col-span-2">
            {!current ? (
              <Card title="Nenhuma OS"><p className="text-sm text-slate-500">Selecione uma OS.</p></Card>
            ) : (
              <>
                <Card title={`OS-${String(current.number).padStart(6, "0")} · enviar`}>
                  <FileUploader ownerType="work_order" ownerId={current.id} folders={["antes", "durante", "depois", "documentos"]} />
                </Card>
                <OsFiles osId={current.id} />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function OsFiles({ osId }: { osId: string }) {
  const { files, loading, reload } = useFiles("work_order", osId);
  const [folder, setFolder] = useState("todas");
  const shown = folder === "todas" ? files : files.filter((f) => f.folder === folder);
  return (
    <Card
      title="Arquivos da OS"
      actions={
        <Select label="Filtrar pasta" value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="todas">Todas as pastas</option>
          <option value="antes">Antes</option>
          <option value="durante">Durante</option>
          <option value="depois">Depois</option>
          <option value="documentos">Documentos</option>
        </Select>
      }
    >
      {loading ? <LoadingState label="Carregando arquivos…" /> : <FileList files={shown} onDelete={reload} />}
    </Card>
  );
}
