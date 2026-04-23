/**
 * Derives the summary stats (totals + per-type counts) from the raw
 * publications list. Returns a Tailwind class per card so the accent colour
 * matches the palette used by `Badge`.
 */
function buildStats(publications) {
  const total = publications.length;
  const count = (type) => publications.filter((p) => p.type === type).length;
  return [
    { label: "Publicaciones", value: total, valueClass: "text-brand-primary" },
    {
      label: "Artículos",
      value: count("journal-article"),
      valueClass: "text-tag-article-text",
    },
    {
      label: "Revisiones",
      value: count("review"),
      valueClass: "text-tag-review-text",
    },
    {
      label: "Conferencias",
      value: count("conference-paper"),
      valueClass: "text-tag-conference-text",
    },
  ];
}

export function StatsRow({ publications }) {
  const stats = buildStats(publications);
  return (
    <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {stats.map(({ label, value, valueClass }) => (
        <div
          key={label}
          className="rounded-xl border border-surface-border/60 bg-surface-primary px-5 py-4"
        >
          <div className="mb-1.5 text-xs tracking-wide text-ink-secondary">
            {label}
          </div>
          <div className={`text-[26px] font-semibold ${valueClass}`}>
            {value}
          </div>
        </div>
      ))}
    </section>
  );
}
