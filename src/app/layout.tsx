import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "CorpServices",
  description:
    "Plataforma corporativa de chamados, ordens de serviço, compras e estoque.",
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
        <SwRegister />
        <AppNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
