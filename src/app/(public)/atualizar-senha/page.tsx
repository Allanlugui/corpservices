"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

function UpdateForm({ token }: { token: string | null }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("Link inválido. Peça outro ao gestor.");
      return;
    }
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
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: next }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message ?? "Não foi possível salvar.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card title="Senha definida">
        <p className="text-sm text-slate-700">Pronto — use a nova senha para entrar.</p>
        <p className="mt-3 text-sm">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Ir para o login</Link>
        </p>
      </Card>
    );
  }

  return (
    <Card title="Nova senha">
      <form onSubmit={onSubmit} className="grid gap-4">
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

export default function AtualizarSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <section className="mx-auto max-w-md">
      <PageHeader title="Restaurar acesso" description="Link enviado pelo gestor (vale 2h, uso único)." />
      <Suspense>
        <UpdateFormWrapper searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function UpdateFormWrapper({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <UpdateForm token={token ?? null} />;
}
