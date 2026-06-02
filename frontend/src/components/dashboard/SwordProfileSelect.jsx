import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "../ui/Icons";
import { ExportProfileIcon } from "../ui/destination-logos/ExportProfileIcon";
import {
  DEFAULT_EXPORT_PROFILE,
  EXPORT_PROFILE_OPTIONS,
  ZIP_DESTINATION_OPTION,
} from "../../utils/exportProfiles";

/**
 * Selector de destino para exportación (perfiles SWORD XML y, opcionalmente, ZIP).
 */
export function SwordProfileSelect({
  value = DEFAULT_EXPORT_PROFILE,
  onChange,
  id = "sword-export-profile",
  className = "",
  includeZip = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const options = useMemo(() => {
    const items = [...EXPORT_PROFILE_OPTIONS];
    if (includeZip) {
      items.push(ZIP_DESTINATION_OPTION);
    }
    return items;
  }, [includeZip]);

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    function handleClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handlePick(optionValue) {
    onChange(optionValue);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`flex w-full flex-col items-start gap-1.5 text-sm sm:w-auto sm:flex-row sm:items-center sm:gap-2 ${className}`.trim()}
    >
      <span className="w-full whitespace-nowrap text-center text-ink-tertiary sm:w-auto sm:text-left">
        Destino:
      </span>
      <div className="relative w-full sm:w-auto sm:flex-none">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="relative inline-flex w-full min-w-44 items-center justify-center rounded-lg border border-surface-border-strong bg-surface-primary px-3 py-2.5 pr-10 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-secondary sm:w-auto"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <ExportProfileIcon profile={selected.value} size={20} />
            <span className="truncate text-center">{selected.label}</span>
          </span>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 shrink-0 -translate-y-1/2" />
        </button>

        {open && (
          <div
            role="listbox"
            aria-labelledby={id}
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-0 overflow-hidden rounded-xl border border-surface-border-strong bg-surface-primary shadow-lg sm:min-w-80"
          >
            {options.map(({ value: optionValue, label, desc }, idx) => (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={optionValue === value}
                onClick={() => handlePick(optionValue)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-secondary ${
                  optionValue === value ? "bg-surface-secondary/70" : ""
                } ${
                  idx < options.length - 1
                    ? "border-b border-surface-border/60"
                    : ""
                }`}
              >
                <ExportProfileIcon profile={optionValue} size={20} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-primary">
                    {label}
                  </div>
                  <div className="text-xs text-ink-tertiary sm:whitespace-nowrap">
                    {desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
