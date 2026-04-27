import { useMemo, useState } from "react";
import { AlertIcon, SearchIcon } from "../ui/Icons";
import { Spinner } from "../ui/Spinner";
import { Badge } from "../ui/Badge";

const COLUMNS = [
  { key: "title", label: "Título" },
  { key: "journal", label: "Revista / Fuente" },
  { key: "publication_year", label: "Año" },
  { key: "doi", label: "DOI" },
  { key: "type", label: "Tipo" },
];

function SortIcon({ active, direction }) {
  const path =
    direction === "asc" || !active ? "M6 8L3 5h6z" : "M6 4l3 3H3z";
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`ml-1 ${active ? "opacity-100" : "opacity-30"}`}
      aria-hidden
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function sortPublications(rows, key, direction) {
  const sorted = [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    const cmp =
      typeof va === "string" ? va.localeCompare(vb) : (va ?? 0) - (vb ?? 0);
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/**
 * Publications table. Owns only UI-state (filter + sort). Data, loading and
 * error states are driven by the parent page so retries and toasts can be
 * handled in one place.
 */
export function PublicationsTable({
  publications,
  loading = false,
  error = null,
  onRetry,
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("publication_year");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const rows = needle
      ? publications.filter(
          (p) =>
            p.title.toLowerCase().includes(needle) ||
            p.journal.toLowerCase().includes(needle) ||
            String(p.publication_year).includes(needle),
        )
      : publications;
    return sortPublications(rows, sortKey, sortDir);
  }, [publications, filter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border/60 bg-surface-primary">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border/60 px-5 py-4">
        <div>
          <h3 className="text-base font-medium text-ink-primary">
            Publicaciones
          </h3>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {filtered.length} de {publications.length} resultados
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Filtrar publicaciones..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-[220px] rounded-lg border border-surface-border-strong bg-surface-secondary py-2 pl-9 pr-3.5 text-[13px] text-ink-primary outline-none focus:border-brand-accent"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary/70">
            <SearchIcon />
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : loading ? (
          <LoadingState />
        ) : (
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-surface-secondary">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="select-none whitespace-nowrap border-b border-surface-border/60 px-4 py-2.5 text-left text-xs font-medium tracking-wide text-ink-secondary"
                  >
                    <span className="flex cursor-pointer items-center">
                      {col.label.toUpperCase()}
                      <SortIcon
                        active={sortKey === col.key}
                        direction={sortDir}
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="p-10 text-center text-sm text-ink-tertiary"
                  >
                    No se encontraron publicaciones con ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((pub, i) => (
                  <tr
                    key={pub.id}
                    className={`transition-colors hover:bg-surface-secondary/70 ${
                      i < filtered.length - 1
                        ? "border-b border-surface-border/60"
                        : ""
                    }`}
                  >
                    <td className="max-w-[280px] px-4 py-3.5 text-[13px] font-medium leading-relaxed text-ink-primary">
                      {pub.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-ink-secondary">
                      {pub.journal}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-medium text-ink-primary">
                      {pub.publication_year}
                    </td>
                    <td className="px-4 py-3.5">
                      <a
                        href={`https://doi.org/${pub.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-nowrap font-mono text-xs text-brand-accent hover:underline"
                      >
                        {pub.doi}
                      </a>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge type={pub.type} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-tertiary">
      <Spinner size={22} />
      <p className="text-sm">Cargando publicaciones…</p>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="text-ink-danger">
        <AlertIcon size={28} />
      </span>
      <div>
        <p className="text-sm font-medium text-ink-primary">
          No se pudieron cargar las publicaciones
        </p>
        <p className="mt-1 text-xs text-ink-tertiary">
          {error?.message ?? "Error desconocido."}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-primary-hover"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
