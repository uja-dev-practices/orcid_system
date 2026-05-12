import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import Footer from "../components/layout/Footer";
import { ResearcherCard } from "../components/dashboard/ResearcherCard";
import { StatsRow } from "../components/dashboard/StatsRow";
import { PublicationsTable } from "../components/dashboard/PublicationsTable";
import { ExportDropdown } from "../components/dashboard/ExportDropdown";
import { SyncButton } from "../components/dashboard/SyncButton";
import {
  downloadExport,
  searchResearcher,
  syncResearcher,
} from "../services/api";
import { isValidOrcid } from "../utils/orcid";
import { useAuth } from "../contexts/AuthContext";

const SUCCESS_FLASH_MS = 3000;

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

  const initialBundle = initialBundleRef.current;
  const [researcher, setResearcher] = useState(initialBundle?.researcher ?? null);
  const [publications, setPublications] = useState(
    initialBundle?.publications ?? [],
  );
  const [pubsLoading, setPubsLoading] = useState(!initialBundle);
  const [pubsError, setPubsError] = useState(null);

  const [syncStatus, setSyncStatus] = useState("idle"); // idle | loading | success
  const [exportingFormat, setExportingFormat] = useState(null);

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
    if (initialBundleRef.current) {
      initialBundleRef.current = null;
      return;
    }
    const ctrl = new AbortController();
    loadBundle(ctrl.signal);
    return () => ctrl.abort();
  }, [orcid, loadBundle]);

  if (!isValidOrcid(orcid)) {
    return <Navigate to="/" replace />;
  }

  async function handleSync() {
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
        description: hasChanges
          ? `${newRecords} nuevas · ${updatedRecords} actualizadas (${totalRecords} total).`
          : "Sin cambios desde la última sincronización.",
      });
      setTimeout(() => setSyncStatus("idle"), SUCCESS_FLASH_MS);
    } catch (err) {
      setSyncStatus("idle");
      toast.error("Error al sincronizar con ORCID", {
        description: err?.message ?? "Inténtalo de nuevo más tarde.",
      });
    }
  }

  async function handleExport(format) {
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
            description: "Ya has descargado todas las publicaciones de este investigador.",
          });
          setExportingFormat(null);
          return;
        }
      } else {
        // Anonymous → download everything
        ids = undefined;
      }

      const { blob } = await downloadExport(orcid, format, {
        publicationIds: ids,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        const extension = format === "xml" ? "xml" : format;
        anchor.download = `sword-${orcid}.${extension}`;
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
      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        description: scope,
      });
    } catch (err) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, {
        description: err?.message ?? "No se pudo generar el fichero.",
      });
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="dashboard" />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-7">
          {researcher ? (
            <ResearcherCard
              researcher={researcher}
              actions={
                <>
                  <SyncButton onClick={handleSync} status={syncStatus} />
                  <ExportDropdown
                    onExport={handleExport}
                    exportingFormat={exportingFormat}
                    selectedCount={selectedIds.size}
                    isAuthenticated={isAuthenticated}
                    newPublicationsCount={newPublicationIds.length}
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
