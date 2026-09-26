"use client";

import { useState, type ReactNode } from "react";

export function Tabs({ tabs, initial = 0 }: { tabs: { id: string; label: string; content: ReactNode }[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  return (
    <div>
      <div role="tablist" aria-label="Seções" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={i === active}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setActive(i)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${i === active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tabs[active].id}`} aria-labelledby={`tab-${tabs[active].id}`} className="py-4">
        {tabs[active].content}
      </div>
    </div>
  );
}
