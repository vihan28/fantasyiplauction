export function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-[2rem] border border-white/50 bg-white/70 p-5 shadow-xl shadow-stone-200/70 backdrop-blur">
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-xl font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
