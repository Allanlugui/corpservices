"use client";

import { useEffect, useState } from "react";
import { Select } from "./ui/fields";
import { useToast } from "./ui/toast";

export interface FileRow {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  folder: string;
  url: string | null;
  created_at: string;
}

const FOLDERS = ["antes", "durante", "depois", "documentos", "nota_fiscal", "foto_checklist"] as const;

export function useFiles(ownerType: string, ownerId: string) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/arquivos?owner_type=${ownerType}&owner_id=${ownerId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!json.error) setFiles(json.data.files as FileRow[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  return { files, loading, reload: load };
}

export function FileUploader({
  ownerType,
  ownerId,
  folder = "documentos",
  folders = [...FOLDERS],
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  label = "Enviar arquivo",
  onUploaded,
}: {
  ownerType: string;
  ownerId: string;
  folder?: string;
  folders?: string[];
  accept?: string;
  label?: string;
  onUploaded?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(folder);

  async function send(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("owner_type", ownerType);
      form.append("owner_id", ownerId);
      form.append("folder", currentFolder);
      const res = await fetch("/api/arquivos", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.error) toast(json.error?.message ?? "Upload recusado.", "error");
      else {
        toast("Arquivo enviado.");
        onUploaded?.();
      }
    } catch {
      toast("Falha de rede.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      {folders.length > 1 ? (
        <Select label="Pasta" value={currentFolder} onChange={(e) => setCurrentFolder(e.target.value)}>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      ) : null}
      <label className="block text-sm font-medium">
        {label}
        <input
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ""; }}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
        />
      </label>
    </div>
  );
}

export function FileList({ files, onDelete }: { files: FileRow[]; onDelete?: () => void }) {
  const toast = useToast();

  async function remove(id: string) {
    const res = await fetch(`/api/arquivos?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Arquivo excluído.");
      onDelete?.();
    } else toast("Sem permissão para excluir.", "error");
  }

  if (files.length === 0) return <p className="text-sm text-slate-500">Nenhum arquivo.</p>;
  return (
    <ul className="grid gap-2">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 p-2 text-sm">
          {f.mime.startsWith("image/") && f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.name} className="h-12 w-12 rounded object-cover" />
            </a>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{f.name}</span>
            <span className="text-xs text-slate-500">{f.folder} · {(f.size_bytes / 1024).toFixed(0)} KB</span>
          </span>
          {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Abrir</a> : null}
          <button type="button" onClick={() => void remove(f.id)} className="font-semibold text-red-700 hover:underline">
            Excluir
          </button>
        </li>
      ))}
    </ul>
  );
}
