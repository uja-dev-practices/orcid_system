import { useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, ChevronDownIcon, FilterIcon, SearchIcon, SparkleIcon } from "../ui/Icons";
import { CustomSelect } from "../ui/CustomSelect";
import { Spinner } from "../ui/Spinner";
import { Badge } from "../ui/Badge";

const COLUMNS = [
  { key: "title", label: "Título", thClass: "w-[35%]" },
  { key: "journal", label: "Revista / Fuente", thClass: "w-[28%]", tdClass: "break-words" },
  { key: "publication_year", label: "Año", thClass: "w-16" },
  { key: "doi", label: "DOI" },
  { key: "type", label: "Tipo", thClass: "w-20" },
];

const PAGE_SIZE = 15;
const EMPTY_SELECTION = new Set();

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
 * Tri-state checkbox. We can't express `indeterminate` via React props, so
 * we set it imperatively on the DOM node whenever the flag changes.
 */
function TriStateCheckbox({ checked, indeterminate = false, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer accent-brand-accent"
    />
  );
}

/**
 * Publications table. UI-state (filter, sort, pagination) lives here; the
 * *selection* set is lifted to the parent so export / bulk actions can see
 * it. Data, loading and error states are also driven by the parent so
 * retries and toasts can be handled in one place.
 *
 * Selection semantics:
 *   - The master checkbox toggles only the rows on the current page.
 *   - Selection is stored by ID in the parent and persists across pages,
 *     filters and sorts so the user can select page by page.
 */
export function PublicationsTable({
  publications,
  loading = false,
  error = null,
  onRetry,
  selectedIds = EMPTY_SELECTION,
  onSelectedIdsChange,
  isAuthenticated = false,
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("publication_year");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const availableYears = useMemo(() => {
    const years = publications
      .map((p) => p.publication_year)
      .filter((y) => typeof y === "number" && Number.isFinite(y));
    if (years.length === 0) return [];
    const min = Math.min(...years);
    const max = Math.max(...years, new Date().getFullYear());
    const list = [];
    for (let y = max; y >= min; y -= 1) list.push(y);
    return list;
  }, [publications]);

  const hasYearFilter = yearFrom !== "" || yearTo !== "";

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (yearFrom && !availableYears.includes(Number(yearFrom))) setYearFrom("");
    if (yearTo && !availableYears.includes(Number(yearTo))) setYearTo("");
  }, [availableYears, yearFrom, yearTo]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    let rows = publications;

    if (needle) {
      rows = rows.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(needle) ||
          (p.journal ?? "").toLowerCase().includes(needle) ||
          String(p.publication_year ?? "").includes(needle) ||
          (p.doi ?? "").toLowerCase().includes(needle),
      );
    }

    if (hasYearFilter) {
      const from = yearFrom ? Number(yearFrom) : null;
      const to = yearTo ? Number(yearTo) : null;
      rows = rows.filter((p) => {
        const year = p.publication_year;
        if (typeof year !== "number" || !Number.isFinite(year)) return false;
        if (from !== null && year < from) return false;
        if (to !== null && year > to) return false;
        return true;
      });
    }

    return sortPublications(rows, sortKey, sortDir);
  }, [publications, filter, yearFrom, yearTo, hasYearFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageSelectionStats = useMemo(() => {
    if (pageRows.length === 0) {
      return { allChecked: false, anyChecked: false };
    }
    let count = 0;
    for (const pub of pageRows) {
      if (selectedIds.has(pub.id)) count += 1;
    }
    return {
      allChecked: count === pageRows.length,
      anyChecked: count > 0,
    };
  }, [pageRows, selectedIds]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      setPage(1);
    } else {
      setSortKey(key);
      setSortDir("desc");
      setPage(1);
    }
  }

  function emit(nextSet) {
    onSelectedIdsChange?.(nextSet);
  }

  function toggleRow(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    emit(next);
  }

  function toggleCurrentPage() {
    const next = new Set(selectedIds);
    if (pageSelectionStats.allChecked) {
      for (const pub of pageRows) next.delete(pub.id);
    } else {
      for (const pub of pageRows) next.add(pub.id);
    }
    emit(next);
  }

  function handleYearFromChange(value) {
    setYearFrom(value);
    // Si el usuario elige un "Desde" mayor que el "Hasta" actual,
    // auto-corregimos el "Hasta" para preservar un rango coherente.
    if (value && yearTo && Number(value) > Number(yearTo)) {
      setYearTo(value);
    }
    setPage(1);
  }

  function handleYearToChange(value) {
    setYearTo(value);
    if (value && yearFrom && Number(value) < Number(yearFrom)) {
      setYearFrom(value);
    }
    setPage(1);
  }

  function clearYearFilter() {
    setYearFrom("");
    setYearTo("");
    setPage(1);
  }

  const pageStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const yearFilterSummary = hasYearFilter
    ? yearFrom && yearTo && yearFrom === yearTo
      ? `Año: ${yearFrom}`
      : `Años: ${yearFrom || "…"} – ${yearTo || "…"}`
    : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border/60 bg-surface-primary">
      {/* Toolbar */}
      <div className="border-b border-surface-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-base font-medium text-ink-primary">
              Publicaciones
            </h3>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              {filtered.length} de {publications.length} resultados
              {yearFilterSummary && (
                <>
                  {" · "}
                  <span className="text-ink-secondary">{yearFilterSummary}</span>
                </>
              )}
              {selectedIds.size > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-brand-accent">
                    {selectedIds.size} seleccionada
                    {selectedIds.size === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="pubs-advanced-filters"
              className={`order-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors sm:order-1 sm:w-auto sm:justify-start ${
                filtersOpen || hasYearFilter
                  ? "border-brand-accent/50 bg-brand-accent/10 text-brand-accent"
                  : "border-surface-border-strong bg-surface-secondary text-ink-secondary hover:bg-surface-primary"
              }`}
            >
              <FilterIcon />
              <span className="sm:hidden">Filtros</span>
              <span className="hidden sm:inline">Filtros avanzados</span>
              {hasYearFilter && (
                <span
                  className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-accent"
                  aria-hidden
                />
              )}
              <ChevronDownIcon
                className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div className="relative order-1 w-full sm:order-2 sm:w-auto">
              <input
                type="text"
                placeholder="Filtrar publicaciones..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-surface-border-strong bg-surface-secondary py-2 pl-9 pr-3.5 text-[13px] text-ink-primary outline-none focus:border-brand-accent sm:w-[220px]"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary/70">
                <SearchIcon />
              </span>
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div
            id="pubs-advanced-filters"
            className="border-t border-surface-border/60 bg-surface-secondary/40 px-5 py-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink-secondary">
                Filtrar por año de publicación
              </p>
              {yearFilterSummary && (
                <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2 py-0.5 text-[11px] font-medium text-brand-accent">
                  {yearFilterSummary}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <label
                  htmlFor="year-from"
                  className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary"
                >
                  Desde
                </label>
                <CustomSelect
                  id="year-from"
                  value={yearFrom}
                  onChange={handleYearFromChange}
                  disabled={availableYears.length === 0}
                  options={availableYears.map((y) => ({
                    value: String(y),
                    label: String(y),
                  }))}
                  className="w-full"
                />
              </div>

              <div className="hidden pb-2 text-center text-sm text-ink-tertiary sm:block">
                —
              </div>

              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <label
                  htmlFor="year-to"
                  className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary"
                >
                  Hasta
                </label>
                <CustomSelect
                  id="year-to"
                  value={yearTo}
                  onChange={handleYearToChange}
                  disabled={availableYears.length === 0}
                  options={availableYears.map((y) => ({
                    value: String(y),
                    label: String(y),
                  }))}
                  className="w-full"
                />
              </div>

              {hasYearFilter && (
                <button
                  type="button"
                  onClick={clearYearFilter}
                  className="rounded-lg border border-surface-border-strong bg-surface-primary px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-secondary"
                >
                  Limpiar
                </button>
              )}
            </div>

            {hasYearFilter && (
              <button
                type="button"
                onClick={clearYearFilter}
                className="sr-only"
              >
                Limpiar rango
              </button>
            )}
            {availableYears.length === 0 && (
              <p className="mb-[2px] text-xs text-ink-tertiary">
                Aún no hay años disponibles.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : loading ? (
          <LoadingState />
        ) : (
          <>
            <div className="md:hidden">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-tertiary">
                  No se encontraron publicaciones con los filtros aplicados.
                </p>
              ) : (
                <>
                  <div className="border-b border-surface-border/60 bg-surface-secondary px-4 py-2.5">
                    <TriStateCheckbox
                      checked={pageSelectionStats.allChecked}
                      indeterminate={pageSelectionStats.anyChecked}
                      onChange={toggleCurrentPage}
                      ariaLabel="Seleccionar todas las publicaciones de esta página"
                    />
                  </div>
                  <div>
                    {pageRows.map((pub, i) => {
                      const isSelected = selectedIds.has(pub.id);
                      return (
                        <article
                          key={pub.id}
                          className={`px-4 py-3.5 transition-colors ${
                            isSelected
                              ? "bg-tag-article-bg/70 hover:bg-tag-article-bg"
                              : "hover:bg-surface-secondary/70"
                          } ${
                            i < pageRows.length - 1
                              ? "border-b border-surface-border/60"
                              : ""
                          }`}
                        >
                          <div className="mb-2 flex items-start gap-2.5">
                            <TriStateCheckbox
                              checked={isSelected}
                              onChange={() => toggleRow(pub.id)}
                              ariaLabel={`Seleccionar publicación ${pub.title}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start gap-1.5">
                                {isAuthenticated && pub.downloaded_by_me === false && (
                                  <span
                                    title="No descargada aún por ti"
                                    className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent"
                                  >
                                    <SparkleIcon size={9} />
                                    Nuevo
                                  </span>
                                )}
                                <p className="text-[14px] font-medium leading-relaxed text-ink-primary">
                                  {pub.title}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5 pl-6.5 text-[12px] text-ink-secondary">
                            <p>
                              <span className="font-medium text-ink-primary">Revista:</span>{" "}
                              {pub.journal || "—"}
                            </p>
                            <p>
                              <span className="font-medium text-ink-primary">Año:</span>{" "}
                              {pub.publication_year ?? "—"}
                            </p>
                            <p>
                              <span className="font-medium text-ink-primary">DOI:</span>{" "}
                              {pub.doi ? (
                                <a
                                  href={`https://doi.org/${pub.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all font-mono text-[11px] text-brand-accent hover:underline"
                                >
                                  {pub.doi}
                                </a>
                              ) : (
                                <span className="font-mono text-[11px] text-ink-tertiary">
                                  —
                                </span>
                              )}
                            </p>
                            <div>
                              <Badge type={pub.type} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <table className="hidden w-full border-collapse md:table">
              <thead>
                <tr className="bg-surface-secondary">
                  <th
                    scope="col"
                    className="w-10 border-b border-surface-border/60 px-4 py-2.5 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TriStateCheckbox
                      checked={pageSelectionStats.allChecked}
                      indeterminate={pageSelectionStats.anyChecked}
                      onChange={toggleCurrentPage}
                      ariaLabel="Seleccionar todas las publicaciones de esta página"
                    />
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`select-none border-b border-surface-border/60 px-4 py-2.5 text-left text-xs font-medium tracking-wide text-ink-secondary${col.thClass ? ` ${col.thClass}` : ""}`}
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
                      colSpan={COLUMNS.length + 1}
                      className="p-10 text-center text-sm text-ink-tertiary"
                    >
                      No se encontraron publicaciones con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((pub, i) => {
                    const isSelected = selectedIds.has(pub.id);
                    return (
                      <tr
                        key={pub.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-tag-article-bg/70 hover:bg-tag-article-bg"
                            : "hover:bg-surface-secondary/70"
                        } ${
                          i < pageRows.length - 1
                            ? "border-b border-surface-border/60"
                            : ""
                        }`}
                      >
                        <td
                          className="w-10 cursor-pointer px-4 py-3.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(pub.id);
                          }}
                        >
                          <TriStateCheckbox
                            checked={isSelected}
                            onChange={() => toggleRow(pub.id)}
                            ariaLabel={`Seleccionar publicación ${pub.title}`}
                          />
                        </td>
                        <td className="max-w-[280px] px-4 py-3.5 text-[13px] font-medium leading-relaxed text-ink-primary">
                          <span className="flex flex-wrap items-start gap-1.5">
                            {isAuthenticated && pub.downloaded_by_me === false && (
                              <span
                                title="No descargada aún por ti"
                                className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent"
                              >
                                <SparkleIcon size={9} />
                                Nuevo
                              </span>
                            )}
                            {pub.title}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-ink-secondary">
                          {pub.journal || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-medium text-ink-primary">
                          {pub.publication_year ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          {pub.doi ? (
                            <a
                              href={`https://doi.org/${pub.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="whitespace-nowrap font-mono text-xs text-brand-accent hover:underline"
                            >
                              {pub.doi}
                            </a>
                          ) : (
                            <span className="whitespace-nowrap font-mono text-xs text-ink-tertiary">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge type={pub.type} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          total={filtered.length}
          onPrev={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
        />
      )}
    </section>
  );
}

function PaginationBar({
  page,
  totalPages,
  pageStart,
  pageEnd,
  total,
  onPrev,
  onNext,
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const isSinglePage = totalPages <= 1;
  const noun = total === 1 ? "publicación" : "publicaciones";
  const visibleCount = pageEnd - pageStart + 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border/60 px-5 py-3">
      {isSinglePage ? (
        // Caso "todo entra en una página": evitamos el "del X al Y"
        // porque coincide con el total y resulta ruidoso. Un simple
        // "Mostrando N de N publicaciones" comunica lo mismo con menos
        // palabras.
        <p className="text-xs text-ink-tertiary">
          Mostrando{" "}
          <span className="font-medium text-ink-secondary">{visibleCount}</span>{" "}
          de <span className="font-medium text-ink-secondary">{total}</span>{" "}
          {noun}
        </p>
      ) : (
        <p className="text-xs text-ink-tertiary">
          Mostrando del{" "}
          <span className="font-medium text-ink-secondary">{pageStart}</span>{" "}
          al <span className="font-medium text-ink-secondary">{pageEnd}</span>{" "}
          de un total de{" "}
          <span className="font-medium text-ink-secondary">{total}</span> {noun}
        </p>
      )}
      {!isSinglePage && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="inline-flex items-center rounded-md border border-surface-border-strong bg-surface-primary px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-ink-tertiary">
            Página <span className="font-medium text-ink-primary">{page}</span>{" "}
            de <span className="font-medium text-ink-primary">{totalPages}</span>
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="inline-flex items-center rounded-md border border-surface-border-strong bg-surface-primary px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
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
