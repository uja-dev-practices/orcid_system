import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import Footer from "../components/layout/Footer";
import { ResearcherCard } from "../components/dashboard/ResearcherCard";
import { StatsRow } from "../components/dashboard/StatsRow";
import { PublicationsTable } from "../components/dashboard/PublicationsTable";
import { ExportDropdown } from "../components/dashboard/ExportDropdown";
import { SyncButton } from "../components/dashboard/SyncButton";
import { ArrowLeftIcon } from "../components/ui/Icons";
import {
  downloadExport,
  searchResearcher,
  syncResearcher,
} from "../services/api";
import { isValidOrcid } from "../utils/orcid";
import {
  DEFAULT_EXPORT_DESTINATION,
  swordXmlFilename,
} from "../utils/exportProfiles";
import { useAuth } from "../contexts/AuthContext";
import {
  markPublicationsAsDownloaded,
  publicationsNeedDownloadFlags,
} from "../utils/downloadTracking";

const SUCCESS_FLASH_MS = 3000;
/** Minimum gap between sync requests (protects backend + avoids toast spam). */
const SYNC_COOLDOWN_MS = 5000;
const SYNC_TOAST_ID = "researcher-sync";
/** Minimum gap between export requests (protects backend + avoids toast spam). */
const EXPORT_COOLDOWN_MS = 5000;
const EXPORT_TOAST_ID = "researcher-export";

/**
 * Researcher detail page. Owns:
 *   - Carga inicial vía `searchResearcher`. Si llegamos desde la landing
 *     usamos el bundle ya cargado en `location.state` para evitar
 *     duplicar la petición.
 *   - Re-sync manual (POST + actualización de estado in-place + toast).
 *   - Exportación SWORD/ZIP:
 *       · Si hay selección manual → exporta esos IDs.
 *       · Si el usuario está autenticado y sin selección → exporta solo
 *         los IDs con downloaded_by_me=false ("lo nuevo").
 *       · Si no está autenticado y sin selección → exporta todo.
 */
export function DashboardPage() {
  const { orcid } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const initialBundleRef = useRef(location.state?.bundle ?? null);
  const consumedInitialBundleRef = useRef(false);

  const initialBundle = initialBundleRef.current;
  const [researcher, setResearcher] = useState(initialBundle?.researcher ?? null);
  const [publications, setPublications] = useState(
    initialBundle?.publications ?? [],
  );
  const [pubsLoading, setPubsLoading] = useState(!initialBundle);
  const [pubsError, setPubsError] = useState(null);

  const [syncStatus, setSyncStatus] = useState("idle"); // idle | loading | success
  const [syncCooldownActive, setSyncCooldownActive] = useState(false);
  const syncInFlightRef = useRef(false);
  const syncCooldownUntilRef = useRef(0);
  const syncCooldownTimerRef = useRef(null);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportCooldownActive, setExportCooldownActive] = useState(false);
  const exportInFlightRef = useRef(false);
  const exportCooldownUntilRef = useRef(0);
  const exportCooldownTimerRef = useRef(null);
  const [exportDestination, setExportDestination] = useState(
    DEFAULT_EXPORT_DESTINATION,
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // IDs de publicaciones que el usuario no ha descargado todavía
  const newPublicationIds = useMemo(
    () =>
      isAuthenticated
        ? publications
            .filter((p) => p.downloaded_by_me === false)
            .map((p) => p.id)
        : [],
    [publications, isAuthenticated],
  );

  const loadBundle = useCallback(
    async (signal) => {
      setPubsLoading(true);
      setPubsError(null);
      try {
        const bundle = await searchResearcher(orcid, { signal });
        if (signal?.aborted) return;
        setResearcher(bundle.researcher);
        setPublications(bundle.publications);
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          const alive = new Set(bundle.publications.map((p) => p.id));
          const next = new Set();
          for (const id of prev) if (alive.has(id)) next.add(id);
          return next.size === prev.size ? prev : next;
        });
      } catch (err) {
        if (signal?.aborted) return;
        setPubsError(err);
        toast.error("No se pudo cargar el investigador", {
          description: err?.message ?? "Error desconocido.",
        });
      } finally {
        if (!signal?.aborted) setPubsLoading(false);
      }
    },
    [orcid],
  );

  useEffect(() => {
    if (!isValidOrcid(orcid)) return;

    const cachedBundle = initialBundleRef.current;
    if (cachedBundle && !consumedInitialBundleRef.current) {
      consumedInitialBundleRef.current = true;
      initialBundleRef.current = null;
      if (
        !publicationsNeedDownloadFlags(
          cachedBundle.publications,
          isAuthenticated,
        )
      ) {
        return;
      }
    }

    const ctrl = new AbortController();
    loadBundle(ctrl.signal);
    return () => ctrl.abort();
  }, [orcid, loadBundle, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (syncCooldownTimerRef.current) {
        clearTimeout(syncCooldownTimerRef.current);
      }
      if (exportCooldownTimerRef.current) {
        clearTimeout(exportCooldownTimerRef.current);
      }
    };
  }, []);

  const syncDisabled = syncStatus !== "idle" || syncCooldownActive;
  const exportDisabled = Boolean(exportingFormat) || exportCooldownActive;

  function startSyncCooldown() {
    syncCooldownUntilRef.current = Date.now() + SYNC_COOLDOWN_MS;
    setSyncCooldownActive(true);
    if (syncCooldownTimerRef.current) {
      clearTimeout(syncCooldownTimerRef.current);
    }
    syncCooldownTimerRef.current = setTimeout(() => {
      setSyncCooldownActive(false);
      syncCooldownTimerRef.current = null;
    }, SYNC_COOLDOWN_MS);
  }

  function startExportCooldown() {
    exportCooldownUntilRef.current = Date.now() + EXPORT_COOLDOWN_MS;
    setExportCooldownActive(true);
    if (exportCooldownTimerRef.current) {
      clearTimeout(exportCooldownTimerRef.current);
    }
    exportCooldownTimerRef.current = setTimeout(() => {
      setExportCooldownActive(false);
      exportCooldownTimerRef.current = null;
    }, EXPORT_COOLDOWN_MS);
  }

  if (!isValidOrcid(orcid)) {
    return <Navigate to="/" replace />;
  }

  async function handleSync() {
    if (
      syncInFlightRef.current ||
      syncStatus !== "idle" ||
      Date.now() < syncCooldownUntilRef.current
    ) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus("loading");

    try {
      const bundle = await syncResearcher(orcid);
      setResearcher(bundle.researcher);
      setPublications(bundle.publications);
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const alive = new Set(bundle.publications.map((p) => p.id));
        const next = new Set();
        for (const id of prev) if (alive.has(id)) next.add(id);
        return next.size === prev.size ? prev : next;
      });

      setSyncStatus("success");
      const { newRecords, updatedRecords, totalRecords } = bundle;
      const hasChanges = newRecords > 0 || updatedRecords > 0;
      toast.success("Sincronización completada", {
        id: SYNC_TOAST_ID,
        description: hasChanges
          ? `${newRecords} nuevas · ${updatedRecords} actualizadas (${totalRecords} total).`
          : "Sin cambios desde la última sincronización.",
      });
      setTimeout(() => setSyncStatus("idle"), SUCCESS_FLASH_MS);
    } catch (err) {
      setSyncStatus("idle");
      toast.error("Error al sincronizar con ORCID", {
        id: SYNC_TOAST_ID,
        description: err?.message ?? "Inténtalo de nuevo más tarde.",
      });
    } finally {
      syncInFlightRef.current = false;
      startSyncCooldown();
    }
  }

  async function handleExport(format, profile = DEFAULT_EXPORT_DESTINATION) {
    if (
      exportInFlightRef.current ||
      exportingFormat ||
      Date.now() < exportCooldownUntilRef.current
    ) {
      return;
    }

    exportInFlightRef.current = true;
    setExportingFormat(format);
    try {
      let ids;
      if (selectedIds.size > 0) {
        // Manual selection takes priority
        ids = Array.from(selectedIds);
      } else if (isAuthenticated) {
        // Authenticated → only download publications not yet downloaded by me
        ids = newPublicationIds;
        if (ids.length === 0) {
          toast.info("No hay publicaciones nuevas", {
            id: EXPORT_TOAST_ID,
            description: "Ya has descargado todas las publicaciones de este investigador.",
          });
          return;
        }
      } else {
        // Anonymous → download everything
        ids = undefined;
      }

      const { blob } = await downloadExport(orcid, format, {
        publicationIds: ids,
        profile: format === "xml" ? profile : undefined,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        const extension = format === "xml" ? "xml" : format;
        anchor.download =
          format === "xml"
            ? swordXmlFilename(orcid, profile)
            : `sword-${orcid}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }

      let scope;
      if (selectedIds.size > 0) {
        scope = `${selectedIds.size} publicación${selectedIds.size === 1 ? "" : "es"} seleccionada${selectedIds.size === 1 ? "" : "s"}`;
      } else if (isAuthenticated) {
        scope = `${newPublicationIds.length} publicación${newPublicationIds.length === 1 ? "" : "es"} nueva${newPublicationIds.length === 1 ? "" : "s"}`;
      } else {
        scope = "todo el investigador";
      }
      if (isAuthenticated && ids?.length) {
        setPublications((prev) => markPublicationsAsDownloaded(prev, ids));
      }

      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        id: EXPORT_TOAST_ID,
        description: scope,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        id: EXPORT_TOAST_ID,
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setExportingFormat(null);
      exportInFlightRef.current = false;
      startExportCooldown();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="dashboard" />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-7">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <ArrowLeftIcon size={14} />
            Volver al inicio
          </Link>

          {researcher ? (
            <ResearcherCard
              researcher={researcher}
              actions={
                <>
                  <SyncButton
                    onClick={handleSync}
                    status={syncStatus}
                    disabled={syncDisabled}
                    className="w-full sm:w-auto"
                  />
                  <ExportDropdown
                    onExport={handleExport}
                    exportingFormat={exportingFormat}
                    disabled={exportDisabled}
                    selectedCount={selectedIds.size}
                    isAuthenticated={isAuthenticated}
                    newPublicationsCount={newPublicationIds.length}
                    exportDestination={exportDestination}
                    onExportDestinationChange={setExportDestination}
                  />
                </>
              }
            />
          ) : (
            <ResearcherSkeleton />
          )}

          <StatsRow publications={publications} />

          <PublicationsTable
            publications={publications}
            loading={pubsLoading}
            error={pubsError}
            onRetry={() => loadBundle()}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ResearcherSkeleton() {
  return (
    <div className="mb-5 h-[120px] animate-pulse rounded-2xl border border-surface-border/60 bg-surface-primary" />
  );
}

export default DashboardPage;
