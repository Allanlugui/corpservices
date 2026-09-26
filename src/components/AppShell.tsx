"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Drawer } from "./ui/drawer";
import { useMe } from "@/hooks/useMe";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden lg:block">
        <Suspense>
          <Sidebar me={me} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </Suspense>
      </div>
      {drawer ? (
        <Drawer title="Menu" onClose={() => setDrawer(false)}>
          <Suspense>
            <Sidebar me={me} collapsed={false} onToggle={() => {}} onNavigate={() => setDrawer(false)} />
          </Suspense>
        </Drawer>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header me={me} onMenu={() => setDrawer(true)} />
        <main id="conteudo" className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
