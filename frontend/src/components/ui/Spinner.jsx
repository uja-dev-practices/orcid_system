/**
 * Small inline spinner. Uses Tailwind's `animate-spin` utility, so no custom
 * keyframes are required. Inherits colour from its parent via `currentColor`.
 */
export function Spinner({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="40 20"
        strokeLinecap="round"
      />
    </svg>
  );
}
