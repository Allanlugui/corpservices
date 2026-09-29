"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Credenciais inválidas ou usuário inexistente.");
        return;
      }
      await fetch("/api/auditoria/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "LOGIN" }),
      }).catch(() => {});
      // Primeiro acesso com senha provisória → troca obrigatória.
      try {
        const me = await fetch("/api/me");
        if (me.ok && (await me.json()).data?.mustReset) {
          router.push("/redefinir-senha?first=1");
          router.refresh();
          return;
        }
      } catch {
        /* segue fluxo normal */
      }
      router.push(searchParams.get("next") ?? "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Acesso à plataforma">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input label="E-mail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Senha" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/recuperar-senha" className="font-semibold text-brand-700 hover:underline">Esqueci a senha</Link>
        </p>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md">
      <PageHeader title="Entrar" description="Acesso restrito a usuários cadastrados pelo gestor." />
      <Suspense>
        <LoginForm />
      </Suspense>
    </section>
  );
}
