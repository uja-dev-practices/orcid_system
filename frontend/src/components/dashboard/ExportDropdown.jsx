import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
} from "../ui/Icons";
import { Spinner } from "../ui/Spinner";

const FORMATS = [
  {
    format: "xml",
    icon: "📄",
    label: "SWORD XML",
    desc: "Metadatos en formato Atom",
  },
  {
    format: "zip",
    icon: "📦",
    label: "Paquete ZIP",
    desc: "XML + ficheros adjuntos",
  },
];

/**
 * SWORD export dropdown. Delegates the actual download to `onExport(format)`
 * so it can be wired up either to the real API or to a mock layer from the
 * parent page.
 *
 * `exportingFormat` (optional) lets the parent keep the button in a loading
 * state between clicks (e.g. while waiting for the backend blob).
 */
export function ExportDropdown({ onExport, exportingFormat = null }) {
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

  function handlePick(format) {
    setOpen(false);
    onExport(format);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isBusy}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border-strong bg-surface-primary px-[18px] py-2.5 text-sm font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isBusy ? <Spinner size={15} /> : <DownloadIcon />}
        {isBusy
          ? `Exportando ${exportingFormat.toUpperCase()}...`
          : "Exportar SWORD"}
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
              <span className="text-xl" aria-hidden>
                {icon}
              </span>
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
