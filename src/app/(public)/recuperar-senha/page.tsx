"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

function RecoverForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${base}/atualizar-senha`,
      });
      if (resetError) {
        setError("Não foi possível enviar. Confira o e-mail.");
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card title="Verifique seu e-mail">
        <p className="text-sm text-slate-700">
          Enviamos um link de restauração para <strong>{email}</strong>. Ele vale por pouco tempo —
          abra e defina sua nova senha.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">← Voltar ao login</Link>
        </p>
      </Card>
    );
  }

  return (
    <Card title="Recuperar acesso">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input label="E-mail corporativo" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Enviando…" : "Enviar link de restauração"}
        </Button>
      </form>
    </Card>
  );
}

export default function RecuperarSenhaPage() {
  return (
    <section className="mx-auto max-w-md">
      <PageHeader title="Esqueci a senha" description="Receba um link para criar uma nova senha." />
      <Suspense>
        <RecoverForm />
      </Suspense>
    </section>
  );
}
