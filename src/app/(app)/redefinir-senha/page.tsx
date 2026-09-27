"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const first = searchParams.get("first") === "1";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("Nova senha: mínimo 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("Confirmação diferente.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/perfil/senha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message ?? "Não foi possível trocar.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title={first ? "Bem-vindo — crie sua senha" : "Redefinir senha"}>
      {first ? <p className="mb-3 text-sm text-slate-600">Este é seu primeiro acesso com senha provisória. Defina sua senha permanente para continuar.</p> : null}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input label={first ? "Senha provisória" : "Senha atual"} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="Nova senha (mín. 8)" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirmar nova" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Salvando…" : "Definir senha"}
        </Button>
      </form>
    </Card>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <section className="mx-auto max-w-md">
      <PageHeader title="Senha" description="Acesso restrito a usuários cadastrados." />
      <Suspense>
        <ResetForm />
      </Suspense>
    </section>
  );
}
