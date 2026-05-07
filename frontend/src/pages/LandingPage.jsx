import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import { DocumentIcon, UsersIcon } from "../components/ui/Icons";
import { OrcidLogo } from "../components/ui/OrcidLogo";
import { Spinner } from "../components/ui/Spinner";
import { formatOrcidInput, isValidOrcid } from "../utils/orcid";
import { getOrcidAuthorizeUrl, searchResearcher } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AUTH_MESSAGE_TYPE, AUTH_ERROR_TYPE } from "../contexts/AuthContext";

/**
 * Entry view: login con ORCID iD + búsqueda individual anónima +
 * buscador grupal para múltiples investigadores.
 *
 * Flujo de login:
 *   - abre popup OAuth → sandbox.orcid.org → /callback
 *   - recibe JWT → cierra popup → estado actualizado aquí.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [orcidInput, setOrcidInput] = useState("");
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Group search state
  const [groupInput, setGroupInput] = useState("");
  const [groupError, setGroupError] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);

  // Cleanup refs for popup polling interval
  const popupRef = useRef(null);
  const popupTimerRef = useRef(null);

  // Clean up popup polling on unmount
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearInterval(popupTimerRef.current);
    };
  }, []);

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
      const bundle = await searchResearcher(orcidInput);
      navigate(`/dashboard/${orcidInput}`, { state: { bundle } });
    } catch (err) {
      toast.error("No se pudo buscar el ORCID iD", {
        description: err?.message ?? "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setValidating(false);
    }
  }

  function handleOrcidLogin() {
    setLoginLoading(true);

    const authorizeUrl = getOrcidAuthorizeUrl();
    const popup = window.open(
      authorizeUrl,
      "orcid_oauth",
      "width=600,height=700,scrollbars=yes,resizable=yes",
    );

    if (!popup || popup.closed) {
      // El navegador bloqueó el popup → hacemos redirect completo
      setLoginLoading(false);
      window.location.href = authorizeUrl;
      return;
    }

    popupRef.current = popup;

    // Escuchamos el postMessage que AuthCallbackPage envía al completar
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === AUTH_MESSAGE_TYPE) {
        cleanup();
        setLoginLoading(false);
        toast.success("Sesión iniciada con ORCID", {
          description: "Ya puedes ver qué publicaciones son nuevas para ti.",
        });
      } else if (event.data?.type === AUTH_ERROR_TYPE) {
        cleanup();
        setLoginLoading(false);
        toast.error("No se pudo iniciar sesión", {
          description: event.data.error ?? "Inténtalo de nuevo.",
        });
      }
    }

    window.addEventListener("message", handleMessage);

    // Detectamos si el usuario cierra el popup manualmente antes de autenticar
    popupTimerRef.current = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setLoginLoading(false);
      }
    }, 500);

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      if (popupTimerRef.current) {
        clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    }
  }

  function parseGroupOrcids(raw) {
    return raw
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleGroupSearch() {
    const ids = parseGroupOrcids(groupInput);
    if (ids.length === 0) {
      setGroupError("Introduce al menos un ORCID iD.");
      return;
    }
    const invalid = ids.filter((id) => !isValidOrcid(id));
    if (invalid.length > 0) {
      setGroupError(`ORCID iDs con formato incorrecto: ${invalid.join(", ")}`);
      return;
    }
    setGroupError("");
    setGroupLoading(true);
    try {
      navigate("/group", { state: { orcidIds: ids } });
    } finally {
      setGroupLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") handleValidate();
  }

  function handleGroupKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleGroupSearch();
    }
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
            {isAuthenticated ? (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
                <span className="font-medium">Sesión activa</span>
                <span className="text-xs text-green-600">
                  Verás publicaciones nuevas marcadas en el dashboard
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleOrcidLogin}
                  disabled={loginLoading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-orcid-green px-5 py-3 text-[15px] font-semibold tracking-wide text-orcid-green-dark transition-opacity enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loginLoading ? <Spinner size={17} /> : <OrcidLogo />}
                  {loginLoading
                    ? "Abriendo ventana de ORCID..."
                    : "Iniciar sesión con ORCID"}
                </button>
              </>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-border" />
              <span className="text-xs tracking-widest text-ink-tertiary">
                {isAuthenticated ? "TU ORCID iD" : "O INTRODUCE TU ORCID iD"}
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
                  disabled={validating || loginLoading || !orcidInput}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                    orcidInput
                      ? "bg-brand-primary text-white enabled:hover:bg-brand-primary-hover"
                      : "bg-surface-secondary text-ink-tertiary"
                  } disabled:cursor-not-allowed`}
                >
                  {validating && <Spinner size={14} />}
                  {validating ? "Buscando..." : "Buscar"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs leading-relaxed text-ink-danger">
                  {error}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-tertiary">
                {isAuthenticated
                  ? "Busca un investigador o usa «Cerrar sesión» arriba."
                  : "Pulsa «Iniciar sesión» para autenticarte, o «Buscar» de forma anónima."}
              </p>
            </div>
          </div>

          {/* Group search card */}
          <div className="mt-4 rounded-2xl border border-surface-border/60 bg-surface-primary p-6">
            <div className="mb-3 flex items-center gap-2">
              <UsersIcon size={17} className="text-brand-accent" />
              <h2 className="text-[14px] font-semibold text-ink-primary">
                Búsqueda grupal de investigadores
              </h2>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-ink-secondary">
              Pega varios ORCID iDs separados por comas, espacios o saltos de
              línea para buscar y comparar varios investigadores a la vez.
            </p>
            <textarea
              rows={3}
              placeholder={"0000-0002-1825-0097\n0000-0001-5000-0007, 0000-0003-4321-9876"}
              value={groupInput}
              onChange={(e) => {
                setGroupInput(e.target.value);
                if (groupError) setGroupError("");
              }}
              onKeyDown={handleGroupKeyDown}
              className={`w-full resize-none rounded-lg border px-3.5 py-2.5 font-mono text-[13px] text-ink-primary outline-none transition-colors ${
                groupError
                  ? "border-border-danger"
                  : "border-surface-border-strong focus:border-brand-accent"
              }`}
            />
            {groupError && (
              <p className="mt-1 text-xs text-ink-danger">{groupError}</p>
            )}
            <button
              type="button"
              onClick={handleGroupSearch}
              disabled={groupLoading || !groupInput.trim()}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                groupInput.trim()
                  ? "bg-brand-primary text-white enabled:hover:bg-brand-primary-hover"
                  : "bg-surface-secondary text-ink-tertiary"
              } disabled:cursor-not-allowed`}
            >
              {groupLoading && <Spinner size={14} />}
              <UsersIcon size={14} />
              {groupLoading ? "Preparando..." : "Buscar investigadores"}
            </button>
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
