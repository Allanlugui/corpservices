import Link from "next/link";

/** Moldura pública: login e portal do solicitante. Estreita por legibilidade. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-3">
          <Link href="/solicitar" className="text-lg font-bold tracking-tight">
            CorpServices
          </Link>
          <span className="ml-3 text-xs text-slate-300">Portal do solicitante</span>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="px-4 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} CorpServices · Todos os direitos reservados
      </footer>
    </div>
  );
}
