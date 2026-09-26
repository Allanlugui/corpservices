import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "CorpServices",
  description: "Plataforma corporativa de chamados, ordens de serviço, compras e estoque.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CorpServices", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
        >
          Pular para o conteúdo
        </a>
        <SwRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
