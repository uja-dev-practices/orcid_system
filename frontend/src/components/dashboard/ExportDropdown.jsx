import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  DocumentIcon,
  DownloadIcon,
  PackageIcon,
  SparkleIcon,
} from "../ui/Icons";
import { Spinner } from "../ui/Spinner";

const FORMATS = [
  {
    format: "xml",
    icon: <DocumentIcon size={20} className="shrink-0 text-ink-secondary" />,
    label: "SWORD XML",
    desc: "Metadatos en formato Atom",
  },
  {
    format: "zip",
    icon: <PackageIcon size={20} className="shrink-0 text-ink-secondary" />,
    label: "Paquete ZIP",
    desc: "XML + ficheros adjuntos",
  },
];

/**
 * SWORD export dropdown. Delegatea the actual download to `onExport(format)`.
 *
 * Props:
 *   - `isAuthenticated`      → cambia el texto del botón principal.
 *   - `newPublicationsCount` → cuántas publicaciones tiene downloaded_by_me=false.
 *   - `selectedCount`        → publicaciones seleccionadas manualmente.
 *   - `exportingFormat`      → formato en curso (pone el botón en loading).
 */
export function ExportDropdown({
  onExport,
  exportingFormat = null,
  selectedCount = 0,
  isAuthenticated = false,
  newPublicationsCount = 0,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isBusy = Boolean(exportingFormat);
  const hasSelection = selectedCount > 0;

  function handlePick(format) {
    setOpen(false);
    onExport(format);
  }

  // Label logic:
  //   manual selection → always "Exportar seleccionadas (N)"
  //   logged in, no selection → "Descargar lo nuevo (N)" or "Todo descargado"
  //   not logged in, no selection → "Descargar todo"
  let idleLabel;
  let showSparkle = false;
  if (hasSelection) {
    idleLabel = `Exportar seleccionadas (${selectedCount})`;
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isBusy || (isAuthenticated && !hasSelection && newPublicationsCount === 0)}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border-strong bg-surface-primary px-[18px] py-2.5 text-sm font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isBusy ? (
          <Spinner size={15} />
        ) : showSparkle ? (
          <SparkleIcon size={15} className="text-brand-accent" />
        ) : (
          <DownloadIcon />
        )}
        {isBusy
          ? `Exportando ${exportingFormat.toUpperCase()}...`
          : idleLabel}
        {!isBusy && <ChevronDownIcon />}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[210px] overflow-hidden rounded-xl border border-surface-border-strong bg-surface-primary shadow-lg">
          {FORMATS.map(({ format, icon, label, desc }, idx) => (
            <button
              key={format}
              type="button"
              onClick={() => handlePick(format)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-secondary ${
                idx < FORMATS.length - 1
                  ? "border-b border-surface-border/60"
                  : ""
              }`}
            >
              {icon}
              <div>
                <div className="text-sm font-medium text-ink-primary">
                  {label}
                </div>
                <div className="text-xs text-ink-tertiary">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
