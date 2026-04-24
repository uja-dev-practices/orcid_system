import { useCallback, useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import { ResearcherCard } from "../components/dashboard/ResearcherCard";
import { StatsRow } from "../components/dashboard/StatsRow";
import { PublicationsTable } from "../components/dashboard/PublicationsTable";
import { ExportDropdown } from "../components/dashboard/ExportDropdown";
import { SyncButton } from "../components/dashboard/SyncButton";
import {
  downloadExport,
  getExportUrl,
  getPublications,
  syncResearcher,
  validateOrcid,
} from "../services/api";
import { isValidOrcid } from "../utils/orcid";

const SUCCESS_FLASH_MS = 3000;

/**
 * Researcher detail page. Owns:
 *   - Initial researcher lookup (validate + publications fetch on mount).
 *   - Sync workflow (POST + refresh + success toast).
 *   - Export workflow (download blob + success/error toast).
 */
export function DashboardPage() {
  const { orcid } = useParams();

  const [researcher, setResearcher] = useState(null);
  const [publications, setPublications] = useState([]);
  const [pubsLoading, setPubsLoading] = useState(true);
  const [pubsError, setPubsError] = useState(null);

  const [syncStatus, setSyncStatus] = useState("idle"); // idle | loading | success
  const [exportingFormat, setExportingFormat] = useState(null);

  const loadResearcher = useCallback(
    async (signal) => {
      try {
        const data = await validateOrcid(orcid, { signal });
        if (!signal?.aborted) setResearcher(data);
      } catch (err) {
        if (signal?.aborted) return;
        toast.error("No se pudo cargar el investigador", {
          description: err?.message ?? "Error desconocido.",
        });
      }
    },
    [orcid],
  );

  const loadPublications = useCallback(
    async (signal) => {
      setPubsLoading(true);
      setPubsError(null);
      try {
        const data = await getPublications(orcid, { signal });
        if (!signal?.aborted) setPublications(data);
      } catch (err) {
        if (signal?.aborted) return;
        setPubsError(err);
      } finally {
        if (!signal?.aborted) setPubsLoading(false);
      }
    },
    [orcid],
  );

  useEffect(() => {
    if (!isValidOrcid(orcid)) return;
    const ctrl = new AbortController();
    loadResearcher(ctrl.signal);
    loadPublications(ctrl.signal);
    return () => ctrl.abort();
  }, [orcid, loadResearcher, loadPublications]);

  if (!isValidOrcid(orcid)) {
    return <Navigate to="/" replace />;
  }

  async function handleSync() {
    setSyncStatus("loading");
    try {
      const summary = await syncResearcher(orcid);

      if (summary?.status === "error") {
        throw new Error(summary.message || "El backend rechazó la sincronización.");
      }

      // El backend devuelve un resumen del SyncJob, no el researcher.
      // Refrescamos ambos recursos en paralelo.
      await Promise.all([loadResearcher(), loadPublications()]);

      setSyncStatus("success");
      const total = summary?.total ?? 0;
      const nuevos = summary?.new_records ?? 0;
      const actualizados = summary?.updated_records ?? 0;
      toast.success("Sincronización completada", {
        description:
          total > 0
            ? `${nuevos} nuevas · ${actualizados} actualizadas (${total} total).`
            : summary?.message ?? "Sin cambios desde la última sincronización.",
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
      const { blob, url } = await downloadExport(orcid, format);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `sword-${orcid}.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      toast.success(`Exportación ${format.toUpperCase()} completada`, {
        description: url ?? getExportUrl(orcid, format),
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
          onRetry={() => loadPublications()}
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
