import {
  DownloadIcon,
  SparkleIcon,
} from "../ui/Icons";
import { Spinner } from "../ui/Spinner";
import { SwordProfileSelect } from "./SwordProfileSelect";
import {
  DEFAULT_EXPORT_DESTINATION,
  resolveExportFromDestination,
} from "../../utils/exportProfiles";

/**
 * Controles de exportación: selector de destino + botón único de descarga.
 * Delega la descarga en `onExport(format, profile)`.
 */
export function ExportDropdown({
  onExport,
  exportingFormat = null,
  selectedCount = 0,
  isAuthenticated = false,
  newPublicationsCount = 0,
  exportDestination = DEFAULT_EXPORT_DESTINATION,
  onExportDestinationChange,
}) {
  const isBusy = Boolean(exportingFormat);
  const hasSelection = selectedCount > 0;

  const nothingToDownload =
    isAuthenticated && !hasSelection && newPublicationsCount === 0;

  function handleDownload() {
    const { format, profile } = resolveExportFromDestination(exportDestination);
    onExport(format, profile);
  }

  let idleLabel;
  let showSparkle = false;
  if (hasSelection) {
    idleLabel = `Descargar selección (${selectedCount})`;
  } else if (isAuthenticated) {
    if (newPublicationsCount > 0) {
      idleLabel = `Descargar lo nuevo (${newPublicationsCount})`;
      showSparkle = true;
    } else {
      idleLabel = "Todo descargado";
    }
  } else {
    idleLabel = "Descargar todo";
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
      <SwordProfileSelect
        id="dashboard-export-destination"
        value={exportDestination}
        onChange={onExportDestinationChange}
        includeZip
      />

      <button
        type="button"
        onClick={handleDownload}
        disabled={isBusy || nothingToDownload}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border-strong bg-surface-primary px-[18px] py-2.5 text-sm font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isBusy ? (
          <Spinner size={15} />
        ) : showSparkle ? (
          <SparkleIcon size={15} className="text-brand-accent" />
        ) : (
          <DownloadIcon />
        )}
        {isBusy ? `Descargando ${exportingFormat.toUpperCase()}...` : idleLabel}
      </button>
    </div>
  );
}
