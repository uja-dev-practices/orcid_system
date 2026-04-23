import {
  DEFAULT_BADGE_CLASSES,
  TYPE_BADGE_CLASSES,
  TYPE_LABELS,
} from "../../utils/publicationTypes";

/**
 * Pill-style badge that colour-codes a publication type (article, review, …).
 * Falls back to the neutral palette for unknown types.
 */
export function Badge({ type }) {
  const label = TYPE_LABELS[type] ?? type;
  const classes = TYPE_BADGE_CLASSES[type] ?? DEFAULT_BADGE_CLASSES;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${classes}`}
    >
      {label}
    </span>
  );
}
