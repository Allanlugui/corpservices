import { Search } from "lucide-react";

export function FilterBar({
  children,
  onSearch,
  searchPlaceholder = "Buscar…",
  searchValue,
}: {
  children?: React.ReactNode;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
      {onSearch ? (
        <label className="relative flex-1">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </label>
      ) : null}
      {children}
    </div>
  );
}
