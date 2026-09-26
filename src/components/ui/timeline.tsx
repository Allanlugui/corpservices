export function Timeline({ items }: { items: { title: string; detail?: string; at: string }[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum evento registrado.</p>;
  }
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200">
      {items.map((item, i) => (
        <li key={i} className="mb-4 ml-4">
          <span aria-hidden className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-slate-900 ring-4 ring-slate-100" />
          <p className="text-sm font-semibold">{item.title}</p>
          {item.detail ? <p className="text-sm text-slate-600">{item.detail}</p> : null}
          <time className="text-xs text-slate-500">{new Date(item.at).toLocaleString("pt-BR")}</time>
        </li>
      ))}
    </ol>
  );
}
