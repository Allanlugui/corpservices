export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
}

/** Tabela corporativa: scroll horizontal seguro no mobile, zebra e hover. */
export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  emptyTitle = "Nenhum registro",
  emptyDescription,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p className="font-semibold">{emptyTitle}</p>
        {emptyDescription ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{emptyDescription}</p> : null}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-160 border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.hideOnMobile ? "hidden lg:table-cell" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-top ${c.hideOnMobile ? "hidden lg:table-cell" : ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
