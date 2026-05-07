import { ClockIcon } from "../ui/Icons";
import { OrcidLogo } from "../ui/OrcidLogo";
import { formatDate, getInitials } from "../../utils/formatters";

/**
 * Header card with avatar + researcher identity + "last sync" timestamp.
 * Accepts an optional `actions` slot so the page can inject the Sync /
 * Export buttons without coupling this component to API logic.
 */
export function ResearcherCard({ researcher, actions = null }) {
  const title = researcher.name || researcher.orcid_id || "Perfil ORCID";
  return (
    <section className="mb-5 flex flex-wrap items-start gap-5 rounded-2xl border border-surface-border/60 bg-surface-primary px-7 py-6">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xl font-semibold text-white">
        {getInitials(title)}
      </div>

      <div className="min-w-[200px] flex-1">
        <h2 className="mb-1 text-[22px] font-semibold text-ink-primary">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5">
            <OrcidLogo />
            <span className="font-mono text-[13px] text-ink-secondary">
              {researcher.orcid_id}
            </span>
          </div>
          {researcher.affiliation && (
            <>
              <span className="text-surface-border-strong">·</span>
              <span className="text-[13px] text-ink-secondary">
                {researcher.affiliation}
              </span>
            </>
          )}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-ink-tertiary">
          <ClockIcon />
          <span className="text-xs">
            Última sincronización: {formatDate(researcher.last_sync_at)}
          </span>
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </section>
  );
}
