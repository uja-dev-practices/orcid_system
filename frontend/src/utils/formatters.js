/**
 * Locale-aware full date + time formatter (used in dashboard headers).
 *
 * The backend stores datetimes in UTC but serialises them without a timezone
 * suffix (e.g. "2026-05-19T08:20:00"). JS Date treats those naive strings as
 * *local* time, which would show the wrong hour in non-UTC browsers. We
 * normalise by appending "Z" so the engine always interprets the value as UTC
 * and toLocaleString then converts it correctly to the user's local timezone.
 */
export function formatDate(iso) {
  if (!iso) return "—";
  const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Builds researcher initials (max 2 chars) from a full name.
 * Si el backend aún no conoce el nombre, devolvemos un guion como
 * placeholder para no dejar el avatar vacío.
 */
export function getInitials(name) {
  if (!name || typeof name !== "string") return "–";
  const trimmed = name.trim();
  if (!trimmed) return "–";
  return trimmed
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
