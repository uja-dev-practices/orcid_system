import { Link } from "react-router-dom";
import { ArrowLeftIcon, LayersIcon } from "../ui/Icons";

/**
 * Institutional navy header used across all views.
 *
 * Variants:
 *   - `landing`  → logo + full product name (centered brand title).
 *   - `dashboard`→ back button to `/` + discrete product label on the right.
 */
export function AppHeader({ variant = "landing" }) {
  if (variant === "dashboard") {
    return (
      <header className="flex h-14 items-center gap-4 bg-brand-primary px-7 text-white">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
        >
          <ArrowLeftIcon />
          Inicio
        </Link>
        <div className="flex-1" />
        <span className="text-[13px] text-white/60">
          Sistema ORCID · SWORD
        </span>
      </header>
    );
  }

  return (
    <header className="flex items-center gap-3 bg-brand-primary px-8 py-3.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-white">
        <LayersIcon />
      </div>
      <span className="text-sm font-medium tracking-wide text-white">
        Sistema de Integración ORCID · SWORD
      </span>
    </header>
  );
}
