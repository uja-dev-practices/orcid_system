/**
 * Locale-aware full date + time formatter (used in dashboard headers).
 */
export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
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
