import { CheckIcon, RefreshIcon } from "../ui/Icons";
import { Spinner } from "../ui/Spinner";

/**
 * Primary action button on the dashboard. Swaps icon + colour scheme
 * depending on the sync lifecycle (idle → loading → success flash).
 */
export function SyncButton({ onClick, status = "idle" }) {
  const isLoading = status === "loading";
  const isSuccess = status === "success";

  const palette = isSuccess
    ? "bg-orcid-green-soft text-orcid-green-text border border-orcid-green-border"
    : isLoading
      ? "bg-surface-secondary text-ink-secondary border border-surface-border"
      : "bg-brand-primary text-white border border-transparent hover:bg-brand-primary-hover";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 rounded-lg px-[18px] py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${palette}`}
    >
      {isLoading ? (
        <Spinner size={15} />
      ) : isSuccess ? (
        <CheckIcon />
      ) : (
        <RefreshIcon />
      )}
      {isLoading
        ? "Sincronizando..."
        : isSuccess
          ? "Sincronizado"
          : "Sincronizar ahora"}
    </button>
  );
}
