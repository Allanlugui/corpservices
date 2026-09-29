"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/skeleton";

function UpdateForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Valida o token do link antes de mostrar o formulário.
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (!tokenHash || type !== "recovery") {
      void Promise.resolve().then(() => {
        if (alive) setError("Link inválido ou expirado. Peça um novo.");
      });
      return () => {
        alive = false;
      };
    }
    createClient()
      .auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      .then(({ error: verifyError }) => {
        if (!alive) return;
        if (verifyError) setError("Link inválido ou expirado. Peça um novo.");
        else setReady(true);
      })
      .catch(() => {
        if (alive) setError("Falha de rede.");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError("Não foi possível salvar. Peça um novo link.");
        return;
      }
      // Limpa o must_reset caso exista (conta criada por convite).
      await fetch("/api/perfil/senha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: next, next }),
      }).catch(() => {});
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <Card title="Link inválido">
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/recuperar-senha" className="font-semibold text-brand-700 hover:underline">Pedir novo link</Link>
        </p>
      </Card>
    );
  }

  if (!ready) return <LoadingState label="Validando link…" />;

  return (
    <Card title="Nova senha">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input label="Nova senha (mín. 8)" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirmar nova" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Salvando…" : "Definir senha"}
        </Button>
      </form>
    </Card>
  );
}

export default function AtualizarSenhaPage() {
  return (
    <section className="mx-auto max-w-md">
      <PageHeader title="Restaurar acesso" description="Defina sua nova senha." />
      <Suspense>
        <UpdateForm />
      </Suspense>
    </section>
  );
}
