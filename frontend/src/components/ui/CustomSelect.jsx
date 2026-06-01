import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "./Icons";

/**
 * Desplegable personalizado (sustituto del `<select>` nativo).
 */
export function CustomSelect({
  id,
  value,
  onChange,
  options = [],
  disabled = false,
  emptyLabel = "Cualquiera",
  className = "",
  menuClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const allOptions = useMemo(
    () => [{ value: "", label: emptyLabel }, ...options],
    [options, emptyLabel],
  );

  const selected =
    allOptions.find((opt) => opt.value === value) ?? allOptions[0];

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
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="inline-flex w-full min-w-[7.5rem] items-center gap-2 rounded-lg border border-surface-border-strong bg-surface-primary px-3 py-2 text-[13px] font-medium text-ink-primary transition-colors enabled:hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDownIcon
          className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-labelledby={id}
          className={`absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 min-w-full overflow-auto rounded-xl border border-surface-border-strong bg-surface-primary py-1 shadow-lg ${menuClassName}`.trim()}
        >
          {allOptions.map((opt) => (
            <button
              key={opt.value || "__any__"}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => handlePick(opt.value)}
              className={`flex w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-secondary ${
                opt.value === value
                  ? "bg-surface-secondary/80 font-medium text-ink-primary"
                  : "text-ink-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
