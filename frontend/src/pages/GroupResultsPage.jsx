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
import {
  DEFAULT_EXPORT_DESTINATION,
  DEFAULT_EXPORT_PROFILE,
  resolveExportFromDestination,
  swordXmlFilename,
} from "../utils/exportProfiles";
import { ExportDropdown } from "../components/dashboard/ExportDropdown";
import { useAuth } from "../contexts/AuthContext";
import { markGroupResultsAsDownloaded } from "../utils/downloadTracking";

const EXPORT_COOLDOWN_MS = 5000;
const GLOBAL_EXPORT_TOAST_ID = "group-export-global";

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
  const [globalExportDestination, setGlobalExportDestination] = useState(
    DEFAULT_EXPORT_DESTINATION,
  );

  // Track per-researcher export state (format | null)
  const [cardExporting, setCardExporting] = useState({});

  const [globalExportCooldownActive, setGlobalExportCooldownActive] =
    useState(false);
  const globalExportInFlightRef = useRef(false);
  const globalExportCooldownUntilRef = useRef(0);
  const globalExportCooldownTimerRef = useRef(null);

  const [cardExportCooldownActive, setCardExportCooldownActive] = useState(
    {},
  );
  const cardExportInFlightRef = useRef(new Set());
  const cardExportCooldownUntilRef = useRef({});
  const cardExportCooldownTimerRef = useRef({});

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
  }, [orcidIds, navigate, isAuthenticated]);

  useEffect(() => {
    const cardTimersObj = cardExportCooldownTimerRef.current;
    return () => {
      const globalTimer = globalExportCooldownTimerRef.current;
      if (globalTimer) {
        clearTimeout(globalTimer);
      }
      for (const t of Object.values(cardTimersObj)) {
        clearTimeout(t);
      }
    };
  }, []);

  function startGlobalExportCooldown() {
    globalExportCooldownUntilRef.current = Date.now() + EXPORT_COOLDOWN_MS;
    setGlobalExportCooldownActive(true);

    if (globalExportCooldownTimerRef.current) {
      clearTimeout(globalExportCooldownTimerRef.current);
    }
    globalExportCooldownTimerRef.current = setTimeout(() => {
      setGlobalExportCooldownActive(false);
      globalExportCooldownUntilRef.current = 0;
      globalExportCooldownTimerRef.current = null;
    }, EXPORT_COOLDOWN_MS);
  }

  function startCardExportCooldown(orcidId) {
    const until = Date.now() + EXPORT_COOLDOWN_MS;
    cardExportCooldownUntilRef.current[orcidId] = until;
    setCardExportCooldownActive((prev) => ({
      ...prev,
      [orcidId]: true,
    }));

    if (cardExportCooldownTimerRef.current[orcidId]) {
      clearTimeout(cardExportCooldownTimerRef.current[orcidId]);
    }
    cardExportCooldownTimerRef.current[orcidId] = setTimeout(() => {
      setCardExportCooldownActive((prev) => ({
        ...prev,
        [orcidId]: false,
      }));
      cardExportCooldownUntilRef.current[orcidId] = 0;
      cardExportCooldownTimerRef.current[orcidId] = null;
    }, EXPORT_COOLDOWN_MS);
  }

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

  async function handleGlobalExport(format, profile = DEFAULT_EXPORT_PROFILE) {
    if (
      globalExportInFlightRef.current ||
      Date.now() < globalExportCooldownUntilRef.current
    ) {
      return;
    }

    const ids =
      isAuthenticated && allNewIds.length > 0 ? allNewIds : allIds;
    if (ids.length === 0) {
      toast.info("No hay publicaciones para exportar", {
        id: GLOBAL_EXPORT_TOAST_ID,
        description:
          "No se encontraron publicaciones en los investigadores cargados.",
      });
      return;
    }

    globalExportInFlightRef.current = true;
    setGlobalExporting(format);
    try {
      // For bulk export we send all IDs together, passing a placeholder orcid
      // since the endpoint is POST /export/{format}/publications (no orcid needed)
      const { blob } = await downloadExport(null, format, {
        publicationIds: ids,
        profile: format === "xml" ? profile : undefined,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download =
          format === "xml"
            ? swordXmlFilename("group", profile)
            : `sword-group.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      if (isAuthenticated) {
        setResults((prev) => markGroupResultsAsDownloaded(prev, ids));
      }

      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        id: GLOBAL_EXPORT_TOAST_ID,
        description: `${ids.length} publicaciones exportadas.`,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        id: GLOBAL_EXPORT_TOAST_ID,
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setGlobalExporting(null);
      globalExportInFlightRef.current = false;
      startGlobalExportCooldown();
    }
  }

  async function handleCardExport(
    orcidId,
    format,
    newIds,
    totalIds,
    profile = DEFAULT_EXPORT_PROFILE,
  ) {
    if (cardExportInFlightRef.current.has(orcidId)) {
      return;
    }
    const now = Date.now();
    const until = cardExportCooldownUntilRef.current[orcidId] ?? 0;
    if (now < until) return;

    const ids =
      isAuthenticated && newIds.length > 0 ? newIds : totalIds;
    if (ids.length === 0) {
      toast.info("No hay publicaciones para exportar", {
        id: `group-export-card-${orcidId}`,
      });
      return;
    }

    cardExportInFlightRef.current.add(orcidId);
    setCardExporting((prev) => ({ ...prev, [orcidId]: format }));
    try {
      const { blob } = await downloadExport(orcidId, format, {
        publicationIds: ids,
        profile: format === "xml" ? profile : undefined,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download =
          format === "xml"
            ? swordXmlFilename(orcidId, profile)
            : `sword-${orcidId}.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      if (isAuthenticated) {
        setResults((prev) => markGroupResultsAsDownloaded(prev, ids));
      }

      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        id: `group-export-card-${orcidId}`,
        description: `${ids.length} publicaciones de ${orcidId}.`,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        id: `group-export-card-${orcidId}`,
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setCardExporting((prev) => {
        const next = { ...prev };
        delete next[orcidId];
        return next;
      });
      cardExportInFlightRef.current.delete(orcidId);
      startCardExportCooldown(orcidId);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="group" />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-7">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <ArrowLeftIcon size={14} />
            Volver al inicio
          </Link>

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
              <ExportDropdown
                onExport={handleGlobalExport}
                exportingFormat={globalExporting}
                disabled={
                  Boolean(globalExporting) || globalExportCooldownActive
                }
                selectedCount={0}
                isAuthenticated={isAuthenticated}
                newPublicationsCount={allNewIds.length}
                exportDestination={globalExportDestination}
                onExportDestinationChange={setGlobalExportDestination}
              />
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
                  exportCooldownActive={
                    cardExportCooldownActive[bundle.researcher?.orcid_id] ??
                    false
                  }
                  onExport={(newIds, totalIds) => {
                    const { format, profile } = resolveExportFromDestination(
                      globalExportDestination,
                    );
                    handleCardExport(
                      bundle.researcher?.orcid_id,
                      format,
                      newIds,
                      totalIds,
                      profile ?? DEFAULT_EXPORT_PROFILE,
                    );
                  }}
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

function ResearcherResultCard({
  bundle,
  isAuthenticated,
  exporting,
  exportCooldownActive,
  onExport,
}) {
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
        <CardExportButton
          onClick={() => onExport(newIds, allPubIds)}
          exporting={exporting}
          isAuthenticated={isAuthenticated}
          hasNew={hasNew}
          newCount={newCount}
          totalCount={totalRecords}
          exportCooldownActive={exportCooldownActive}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Per-card download button ────────────────────── */

function CardExportButton({
  onClick,
  exporting,
  isAuthenticated,
  hasNew,
  newCount,
  totalCount,
  exportCooldownActive,
}) {
  const isBusy = Boolean(exporting);
  const disabled = isBusy || exportCooldownActive;

  let label;
  if (isBusy) {
    label = `Descargando ${exporting.toUpperCase()}...`;
  } else if (exportCooldownActive) {
    label = "Espera un momento...";
  } else if (isAuthenticated) {
    label = hasNew ? `Descargar (${newCount})` : "Todo descargado";
  } else {
    label = `Descargar (${totalCount})`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-border-strong bg-surface-primary px-3 py-2 text-[13px] font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
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
