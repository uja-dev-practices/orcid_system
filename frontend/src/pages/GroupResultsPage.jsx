import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import Footer from "../components/layout/Footer";
import { Spinner } from "../components/ui/Spinner";
import { OrcidLogo } from "../components/ui/OrcidLogo";
import {
  AlertIcon,
  ArrowLeftIcon,
  DownloadIcon,
  SparkleIcon,
  UsersIcon,
} from "../components/ui/Icons";
import { downloadExport, searchResearchersBulk } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

/**
 * Group results view: shows one summary card per researcher, plus a global
 * "download all new" (or "download everything") action in the header.
 *
 * Receives `{ orcidIds: string[] }` via `location.state` (set by LandingPage).
 * If no state is present the user is redirected back to `/`.
 */
export function GroupResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const orcidIds = location.state?.orcidIds;

  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalExporting, setGlobalExporting] = useState(null); // format | null

  // Track per-researcher export state (format | null)
  const [cardExporting, setCardExporting] = useState({});

  const abortRef = useRef(null);

  useEffect(() => {
    if (!orcidIds || orcidIds.length === 0) {
      navigate("/", { replace: true });
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      setLoading(true);
      try {
        const data = await searchResearchersBulk(orcidIds, {
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        setResults(data.results ?? []);
        setErrors(data.errors ?? []);

        const failCount = (data.errors ?? []).length;
        const okCount = (data.results ?? []).length;
        if (failCount > 0) {
          toast.warning(
            `${okCount} investigador${okCount !== 1 ? "es" : ""} cargado${okCount !== 1 ? "s" : ""}, ${failCount} con error`,
            {
              description: "Comprueba los ORCID iDs que fallaron abajo.",
            },
          );
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        toast.error("Error al buscar investigadores", {
          description: err?.message ?? "Inténtalo de nuevo.",
        });
        setResults([]);
        setErrors([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [orcidIds, navigate]);

  // All new publication IDs across all loaded researchers
  const allNewIds = useMemo(() => {
    if (!isAuthenticated) return [];
    return results.flatMap((r) =>
      (r.publications ?? [])
        .filter((p) => p.downloaded_by_me === false)
        .map((p) => p.id),
    );
  }, [results, isAuthenticated]);

  const allIds = useMemo(
    () => results.flatMap((r) => (r.publications ?? []).map((p) => p.id)),
    [results],
  );

  async function handleGlobalExport(format) {
    const ids = isAuthenticated ? allNewIds : allIds;
    if (ids.length === 0) {
      toast.info(
        isAuthenticated
          ? "No hay publicaciones nuevas"
          : "No hay publicaciones para exportar",
        { description: "No se encontraron publicaciones en los investigadores cargados." },
      );
      return;
    }
    setGlobalExporting(format);
    try {
      // For bulk export we send all IDs together, passing a placeholder orcid
      // since the endpoint is POST /export/{format}/publications (no orcid needed)
      const { blob } = await downloadExport(null, format, {
        publicationIds: ids,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `sword-group.${format === "xml" ? "xml" : format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        description: `${ids.length} publicaciones exportadas.`,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setGlobalExporting(null);
    }
  }

  async function handleCardExport(orcidId, format, newIds, totalIds) {
    const ids = isAuthenticated ? newIds : totalIds;
    if (ids.length === 0) {
      toast.info("No hay publicaciones para exportar");
      return;
    }
    setCardExporting((prev) => ({ ...prev, [orcidId]: format }));
    try {
      const { blob } = await downloadExport(orcidId, format, {
        publicationIds: ids,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `sword-${orcidId}.${format === "xml" ? "xml" : format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        description: `${ids.length} publicaciones de ${orcidId}.`,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setCardExporting((prev) => {
        const next = { ...prev };
        delete next[orcidId];
        return next;
      });
    }
  }

  const globalLabel = isAuthenticated
    ? allNewIds.length > 0
      ? `Descargar lo nuevo de todos (${allNewIds.length})`
      : "Todo descargado"
    : `Descargar todo (${allIds.length})`;

  const globalDisabled =
    Boolean(globalExporting) ||
    (isAuthenticated ? allNewIds.length === 0 : allIds.length === 0);

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="group" />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-7">
          {/* Page header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white">
                <UsersIcon size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink-primary">
                  Búsqueda grupal
                </h1>
                {!loading && (
                  <p className="text-xs text-ink-tertiary">
                    {results.length} investigador{results.length !== 1 ? "es" : ""} encontrado{results.length !== 1 ? "s" : ""}
                    {errors.length > 0 && (
                      <span className="ml-1 text-ink-danger">
                        · {errors.length} con error
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Global export buttons */}
            {!loading && results.length > 0 && (
              <div className="flex gap-2">
                {["xml", "zip"].map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleGlobalExport(fmt)}
                    disabled={globalDisabled}
                    className="inline-flex items-center gap-2 rounded-lg border border-surface-border-strong bg-surface-primary px-4 py-2 text-sm font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {globalExporting === fmt ? (
                      <Spinner size={14} />
                    ) : isAuthenticated && allNewIds.length > 0 ? (
                      <SparkleIcon size={13} className="text-brand-accent" />
                    ) : (
                      <DownloadIcon size={14} />
                    )}
                    {globalExporting === fmt
                      ? `Exportando ${fmt.toUpperCase()}...`
                      : `${fmt.toUpperCase()} · ${globalLabel}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-tertiary">
              <Spinner size={28} />
              <p className="text-sm">
                Sincronizando {orcidIds?.length ?? "?"} investigadores con ORCID...
              </p>
              <p className="text-xs text-ink-tertiary/60">
                Esto puede tardar unos segundos si hay muchos perfiles nuevos.
              </p>
            </div>
          )}

          {/* Results grid */}
          {!loading && results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((bundle) => (
                <ResearcherResultCard
                  key={bundle.researcher?.orcid_id}
                  bundle={bundle}
                  isAuthenticated={isAuthenticated}
                  exporting={cardExporting[bundle.researcher?.orcid_id] ?? null}
                  onExport={(fmt, newIds, totalIds) =>
                    handleCardExport(
                      bundle.researcher?.orcid_id,
                      fmt,
                      newIds,
                      totalIds,
                    )
                  }
                />
              ))}
            </div>
          )}

          {/* Errors */}
          {!loading && errors.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-medium text-ink-secondary">
                ORCID iDs que no pudieron cargarse
              </h2>
              <div className="space-y-2">
                {errors.map((e) => (
                  <div
                    key={e.orcid_id}
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <AlertIcon size={16} className="mt-0.5 shrink-0 text-red-500" />
                    <div>
                      <p className="font-mono text-[13px] font-medium text-red-700">
                        {e.orcid_id}
                      </p>
                      <p className="text-xs text-red-500">
                        {e.detail ?? "No se pudo obtener información de este ORCID."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && errors.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-ink-tertiary">
              <UsersIcon size={32} className="opacity-30" />
              <p className="text-sm">No se encontraron resultados.</p>
              <Link
                to="/"
                className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover"
              >
                <ArrowLeftIcon />
                Volver al inicio
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ─────────────────────────── Researcher card ─────────────────────────── */

function ResearcherResultCard({ bundle, isAuthenticated, exporting, onExport }) {
  const researcher = bundle.researcher ?? {};
  const publications = bundle.publications ?? [];
  const totalRecords = bundle.totalRecords ?? publications.length;

  const newIds = isAuthenticated
    ? publications.filter((p) => p.downloaded_by_me === false).map((p) => p.id)
    : [];

  const allPubIds = publications.map((p) => p.id);

  const newCount = newIds.length;
  const hasNew = isAuthenticated && newCount > 0;

  const initials = getInitials(researcher.name);

  return (
    <div className="flex flex-col rounded-2xl border border-surface-border/60 bg-surface-primary p-5 shadow-sm">
      {/* Researcher identity */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-base font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-primary">
            {researcher.name || "Sin nombre"}
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <OrcidLogo />
            <span className="truncate font-mono text-[12px] text-ink-secondary">
              {researcher.orcid_id}
            </span>
          </div>
          {researcher.affiliation && (
            <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
              {researcher.affiliation}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-ink-primary">{totalRecords}</p>
          <p className="text-[11px] text-ink-tertiary">publicaciones</p>
        </div>
        {isAuthenticated && (
          <>
            <div className="h-8 w-px bg-surface-border" />
            <div className="flex-1 text-center">
              <p className={`text-lg font-bold ${hasNew ? "text-brand-accent" : "text-ink-tertiary"}`}>
                {newCount}
              </p>
              <p className="text-[11px] text-ink-tertiary">nuevas</p>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          to={`/dashboard/${researcher.orcid_id}`}
          state={{ bundle }}
          className="flex-1 rounded-lg border border-surface-border-strong bg-surface-secondary px-3 py-2 text-center text-[13px] font-medium text-ink-primary transition-colors hover:bg-surface-primary"
        >
          Ver detalle
        </Link>
        <ExportFormatMenu
          onExport={(fmt) => onExport(fmt, newIds, allPubIds)}
          exporting={exporting}
          isAuthenticated={isAuthenticated}
          hasNew={hasNew}
          newCount={newCount}
          totalCount={totalRecords}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Inline export format picker ─────────────────── */

function ExportFormatMenu({
  onExport,
  exporting,
  isAuthenticated,
  hasNew,
  newCount,
  totalCount,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isBusy = Boolean(exporting);
  const disabled =
    isBusy || (isAuthenticated && !hasNew && totalCount > 0 && newCount === 0);

  let label;
  if (isBusy) {
    label = `Exportando ${exporting.toUpperCase()}...`;
  } else if (isAuthenticated) {
    label = hasNew ? `Nuevo (${newCount})` : "Descargado";
  } else {
    label = `Todo (${totalCount})`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border-strong bg-surface-primary px-3 py-2 text-[13px] font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? (
          <Spinner size={13} />
        ) : hasNew ? (
          <SparkleIcon size={11} className="text-brand-accent" />
        ) : (
          <DownloadIcon size={13} />
        )}
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[160px] overflow-hidden rounded-xl border border-surface-border-strong bg-surface-primary shadow-lg">
          {["xml", "zip"].map((fmt, idx) => (
            <button
              key={fmt}
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(fmt);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-ink-primary transition-colors hover:bg-surface-secondary ${
                idx === 0 ? "border-b border-surface-border/60" : ""
              }`}
            >
              <DownloadIcon size={13} />
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────────────── */

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default GroupResultsPage;
