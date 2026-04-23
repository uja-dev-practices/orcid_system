import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import { DocumentIcon } from "../components/ui/Icons";
import { OrcidLogo } from "../components/ui/OrcidLogo";
import { Spinner } from "../components/ui/Spinner";
import { formatOrcidInput, isValidOrcid } from "../utils/orcid";
import { validateOrcid } from "../services/api";

/**
 * Entry view: OAuth button + manual ORCID iD entry.
 * Navigates to `/dashboard/:orcid` after a successful `validateOrcid` call.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const [orcidInput, setOrcidInput] = useState("");
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  function handleOrcidChange(event) {
    setOrcidInput(formatOrcidInput(event.target.value));
    if (error) setError("");
  }

  async function handleValidate() {
    if (!isValidOrcid(orcidInput)) {
      setError(
        "Formato inválido. El ORCID iD debe tener la estructura: 0000-0002-1234-5678",
      );
      return;
    }
    setValidating(true);
    try {
      await validateOrcid(orcidInput);
      navigate(`/dashboard/${orcidInput}`);
    } catch (err) {
      toast.error("No se pudo validar el ORCID iD", {
        description: err?.message ?? "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setValidating(false);
    }
  }

  async function handleOrcidLogin() {
    setOauthLoading(true);
    try {
      // Real implementation will redirect to ORCID OAuth (handled by backend).
      // For now we emulate the flow locally with a known sample ORCID.
      await new Promise((r) => setTimeout(r, 800));
      navigate(`/dashboard/0000-0002-1234-5678`);
    } catch (err) {
      toast.error("No se pudo iniciar sesión con ORCID", {
        description: err?.message ?? "Inténtalo de nuevo.",
      });
    } finally {
      setOauthLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") handleValidate();
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="landing" />

      <main className="flex flex-1 items-center justify-center p-12 sm:p-6">
        <div className="w-full max-w-[520px]">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-brand-primary shadow-[0_4px_24px_rgba(11,61,107,0.18)]">
              <DocumentIcon size={36} className="text-white" />
            </div>
            <h1 className="mb-2 text-[28px] font-semibold tracking-tight text-ink-primary">
              Repositorio Institucional
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-secondary">
              Conecta tu perfil ORCID y deposita tus publicaciones
              automáticamente en el repositorio institucional vía protocolo
              SWORD.
            </p>
          </div>

          {/* Main card */}
          <div className="rounded-2xl border border-surface-border/60 bg-surface-primary p-8">
            <button
              type="button"
              onClick={handleOrcidLogin}
              disabled={oauthLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-orcid-green px-5 py-3 text-[15px] font-semibold tracking-wide text-orcid-green-dark transition-opacity enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-75"
            >
              {oauthLoading ? <Spinner size={17} /> : <OrcidLogo />}
              {oauthLoading
                ? "Redirigiendo a ORCID..."
                : "Iniciar sesión con ORCID"}
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-border" />
              <span className="text-xs tracking-widest text-ink-tertiary">
                O INTRODUCE TU ORCID iD
              </span>
              <div className="h-px flex-1 bg-surface-border" />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-ink-secondary">
                ORCID iD
              </label>
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000-0002-1234-5678"
                    value={orcidInput}
                    onChange={handleOrcidChange}
                    onKeyDown={handleKeyDown}
                    maxLength={19}
                    className={`w-full rounded-lg py-2.5 pl-10 pr-3.5 font-mono text-[15px] tracking-wider text-ink-primary outline-none transition-colors ${
                      error
                        ? "border border-border-danger"
                        : "border border-surface-border-strong focus:border-brand-accent"
                    }`}
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <OrcidLogo />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating || !orcidInput}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                    orcidInput
                      ? "bg-brand-primary text-white enabled:hover:bg-brand-primary-hover"
                      : "bg-surface-secondary text-ink-tertiary"
                  } disabled:cursor-not-allowed`}
                >
                  {validating && <Spinner size={14} />}
                  {validating ? "Validando..." : "Buscar"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs leading-relaxed text-ink-danger">
                  {error}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-tertiary">
                Formato: 16 dígitos separados con guiones (ej.
                0000-0002-1234-5678)
              </p>
            </div>
          </div>

          {/* Info chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {["ORCID OAuth 2.0", "SWORD v2", "DSpace · EPrints"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-surface-border/60 bg-surface-secondary px-3 py-1 text-xs text-ink-tertiary"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
