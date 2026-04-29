/**
 * Centralised collection of inline SVG icons used across the app. Keeping
 * them here avoids pulling a full icon library for ~10 glyphs while still
 * letting consumers style them via `className` (stroke inherits from
 * `currentColor`).
 */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function DocumentIcon({ size = 36, className = "" }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 12h6M9 16h6M9 8h2" />
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M13 2v5a2 2 0 002 2h5" />
    </svg>
  );
}

export function LayersIcon({ size = 18, className = "" }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3L2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 14, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

export function ClockIcon({ size = 13, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.5} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function CheckIcon({ size = 15, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function RefreshIcon({ size = 15, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
    </svg>
  );
}

export function DownloadIcon({ size = 15, className = "" }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SearchIcon({ size = 14, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function FilterIcon({ size = 14, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

export function AlertIcon({ size = 16, className = "" }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function PackageIcon({ size = 18, className = "" }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
      <path d="M7.5 4.21l9 5.16" />
    </svg>
  );
}

export function LogoutIcon({ size = 15, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function UsersIcon({ size = 16, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function SparkleIcon({ size = 12, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

export function UserCheckIcon({ size = 15, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}
