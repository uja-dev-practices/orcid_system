import {
  DEFAULT_EXPORT_PROFILE,
  EXPORT_PROFILE_OPTIONS,
} from "../../utils/exportProfiles";

/**
 * Selector de destino para exportación SWORD XML (DSpace, EPrints, Dublin Core…).
 */
export function SwordProfileSelect({
  value = DEFAULT_EXPORT_PROFILE,
  onChange,
  id = "sword-export-profile",
  className = "",
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 text-sm ${className}`.trim()}
    >
      <span className="whitespace-nowrap text-ink-tertiary">Destino:</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-[9.5rem] rounded-lg border border-surface-border-strong bg-surface-primary px-2.5 py-2 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-secondary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      >
        {EXPORT_PROFILE_OPTIONS.map(({ value: optionValue, label }) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
