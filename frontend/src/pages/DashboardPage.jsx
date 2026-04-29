import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
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

const SUCCESS_FLASH_MS = 3000;

/**
 * Researcher detail page. Owns:
 *   - Carga inicial vía `searchResearcher` (todo en uno: researcher +
 *     publications + resumen de cambios). Si llegamos desde la landing
 *     usamos el bundle ya cargado en `location.state` para evitar
 *     duplicar la petición.
 *   - Re-sync manual (POST + actualización de estado in-place + toast).
 *   - Exportación SWORD/ZIP (selectiva si hay selección, masiva si no).
 */
export function DashboardPage() {
  const { orcid } = useParams();
  const location = useLocation();
  // El bundle del Landing solo lo consumimos UNA vez: la primera vez
  // que se monta el componente. Si el usuario refresca, navega o vuelve
  // atrás, queremos que se vuelva a pedir al backend.
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

  /**
   * Carga (o recarga) el bundle completo del investigador. Centralizamos
   * la lógica aquí para que tanto el `useEffect` inicial como el botón
   * "Reintentar" del estado de error compartan código.
   */
  const loadBundle = useCallback(
    async (signal) => {
      setPubsLoading(true);
      setPubsError(null);
      try {
        const bundle = await searchResearcher(orcid, { signal });
        if (signal?.aborted) return;
        setResearcher(bundle.researcher);
        setPublications(bundle.publications);
        // La selección sobrevive recargas: nos quedamos con los IDs que
        // siguen existiendo tras el sync, descartamos los que no.
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
    // Si venimos del Landing con el bundle precargado, evitamos la
    // segunda petición y consumimos el ref para que un refresh sí pegue
    // al backend.
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
      const ids = Array.from(selectedIds);
      const { blob } = await downloadExport(orcid, format, {
        publicationIds: ids.length > 0 ? ids : undefined,
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        // Usamos extensiones reales: el endpoint SWORD devuelve XML.
        const extension = format === "xml" ? "xml" : format;
        anchor.download = `sword-${orcid}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      const scope =
        ids.length > 0
          ? `${ids.length} publicación${ids.length === 1 ? "" : "es"} seleccionada${ids.length === 1 ? "" : "s"}`
          : "todo el investigador";
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
        />

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-xs text-ink-tertiary">
            Datos obtenidos vía ORCID Public API v3.0
          </span>
          <div className="flex gap-4">
            {["ORCID OAuth 2.0", "SWORD v2", "Dublin Core"].map((t) => (
              <span key={t} className="text-xs text-ink-tertiary">
                {t}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

function ResearcherSkeleton() {
  return (
    <div className="mb-5 h-[120px] animate-pulse rounded-2xl border border-surface-border/60 bg-surface-primary" />
  );
}

export default DashboardPage;
