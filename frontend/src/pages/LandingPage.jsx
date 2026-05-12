import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "../components/layout/AppHeader";
import { UsersIcon } from "../components/ui/Icons";
import { OrcidLogo } from "../components/ui/OrcidLogo";
import { Spinner } from "../components/ui/Spinner";
import { getInitials } from "../utils/formatters";
import { formatOrcidInput, isValidOrcid } from "../utils/orcid";
import { getOrcidAuthorizeUrl, searchResearcher } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AUTH_MESSAGE_TYPE, AUTH_ERROR_TYPE } from "../contexts/AuthContext";
import Footer from "../components/layout/Footer";

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
  const { isAuthenticated, userName, userOrcidId } = useAuth();

  // If the JWT doesn't carry the name (ORCID sandbox omits it), fetch it
  // lazily from the public researcher endpoint so the identity block is correct.
  const [resolvedName, setResolvedName] = useState(null);
  useEffect(() => {
    if (!isAuthenticated || !userOrcidId) { setResolvedName(null); return; }
    if (userName) { setResolvedName(userName); return; }
    let cancelled = false;
    searchResearcher(userOrcidId)
      .then((bundle) => { if (!cancelled) setResolvedName(bundle.researcher?.name ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, userOrcidId, userName]);

  const displayName = resolvedName ?? userName;

  const [orcidInput, setOrcidInput] = useState("");
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Group search state
  const [groupTags, setGroupTags] = useState([]);
  const [groupRawInput, setGroupRawInput] = useState("");
  const [groupError, setGroupError] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);
  const groupInputRef = useRef(null);

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

  /**
   * Splits a raw string on comma/space/newline separators, promotes valid
   * ORCIDs to tags (deduplicating against existing ones), and returns any
   * leftover invalid tokens joined by a space so the user can correct them.
   */
  function commitRawInput(raw) {
    const parts = raw.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    const valid = parts.filter(isValidOrcid);
    const invalid = parts.filter((p) => !isValidOrcid(p));
    if (valid.length > 0) {
      setGroupTags((prev) => [...new Set([...prev, ...valid])]);
      if (groupError) setGroupError("");
    }
    return invalid.join(" ");
  }

  function handleGroupTagKeyDown(event) {
    const { key } = event;
    if (key === "Enter" || key === "," || key === " ") {
      event.preventDefault();
      const leftover = commitRawInput(groupRawInput);
      setGroupRawInput(leftover);
    } else if (key === "Backspace" && groupRawInput === "" && groupTags.length > 0) {
      setGroupTags((prev) => prev.slice(0, -1));
    }
  }

  function handleGroupRawChange(event) {
    setGroupRawInput(event.target.value);
    if (groupError) setGroupError("");
  }

  function handleGroupPaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const combined = groupRawInput ? `${groupRawInput} ${pasted}` : pasted;
    const leftover = commitRawInput(combined);
    setGroupRawInput(leftover);
  }

  function removeGroupTag(tag) {
    setGroupTags((prev) => prev.filter((t) => t !== tag));
    if (groupError) setGroupError("");
  }

  async function handleGroupSearch() {
    if (groupTags.length === 0) {
      setGroupError("Introduce al menos un ORCID iD válido.");
      return;
    }
    setGroupError("");
    setGroupLoading(true);
    try {
      navigate("/group", { state: { orcidIds: groupTags } });
    } finally {
      setGroupLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") handleValidate();
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-tertiary">
      <AppHeader variant="landing" />

      <main className="flex flex-1 flex-col items-center px-4 pb-12 pt-16">
        <div className="w-full max-w-7xl">

          {/* ── Hero ── */}
          <div className="mb-12 text-center">
            <h1 className="mb-3 text-[36px] font-bold tracking-tight text-ink-primary md:text-[46px]">
              Tus publicaciones, listas para depositar.
            </h1>
            <p className="mx-auto max-w-xl text-[16px] leading-relaxed text-ink-secondary">
              Conecta tu ORCID y descárgalas en XML cuando quieras.
            </p>
          </div>

          {/* ── Two-column grid ── */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">

            {/* ── Left: individual search + login ── */}
            <div className="flex flex-col rounded-2xl border border-surface-border/30 bg-surface-primary p-8 shadow-sm">
              {isAuthenticated ? (
                <Link
                  to={userOrcidId ? `/dashboard/${userOrcidId}` : "/"}
                  className="flex w-full items-center gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-surface-secondary"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-base font-semibold text-white">
                    {getInitials(displayName ?? userOrcidId ?? "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-primary">
                      {displayName ?? "Mi Perfil"}
                    </p>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-secondary">
                      <OrcidLogo size={14} />
                      <span className="font-mono">{userOrcidId ?? "—"}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-tertiary">
                      Verás publicaciones nuevas marcadas en el dashboard
                    </p>
                  </div>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOrcidLogin}
                    disabled={loginLoading}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-orcid-green px-6 py-4 text-[16px] font-semibold tracking-wide text-orcid-green-dark shadow-sm transition-opacity enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    {loginLoading ? <Spinner size={17} /> : <OrcidLogo />}
                    {loginLoading
                      ? "Abriendo ventana de ORCID..."
                      : "Iniciar sesión con ORCID"}
                  </button>
                  <p className="mt-2.5 text-center text-sm text-ink-tertiary">
                    Actualizamos tus publicaciones automáticamente cada mes.
                  </p>
                </>
              )}

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-surface-border" />
                <span className="text-xs tracking-widest text-ink-tertiary">
                  {isAuthenticated ? "TU ORCID iD" : "O INTRODUCE TU ORCID iD"}
                </span>
                <div className="h-px flex-1 bg-surface-border" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-ink-secondary">
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
                      className={`w-full rounded-lg py-3 pl-10 pr-3.5 font-mono text-[15px] tracking-wider text-ink-primary outline-none transition-colors ${
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
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
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
                  <p className="text-xs leading-relaxed text-ink-danger">
                    {error}
                  </p>
                )}
                <p className="text-xs text-ink-tertiary">
                  {isAuthenticated
                    ? "Busca un investigador o usa «Cerrar sesión» arriba."
                    : "Pulsa «Iniciar sesión» para autenticarte, o «Buscar» de forma anónima."}
                </p>
              </div>
            </div>

            {/* ── Right: group search ── */}
            <div className="flex flex-col rounded-2xl border border-surface-border/20 bg-surface-secondary p-8 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <UsersIcon size={16} className="text-ink-tertiary" />
                <h2 className="text-[14px] font-semibold text-ink-secondary">
                  Búsqueda grupal de investigadores
                </h2>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-ink-secondary">
                Pega varios ORCID iDs separados por comas, espacios o saltos de
                línea para buscar y comparar varios investigadores a la vez.
              </p>
              {/* ── Tag input area ── */}
              <div
                role="textbox"
                aria-multiline="true"
                aria-label="ORCID iDs"
                onClick={() => groupInputRef.current?.focus()}
                className={`flex min-h-[120px] cursor-text flex-wrap content-start gap-1.5 overflow-y-auto rounded-lg border px-3 py-2.5 transition-colors ${
                  groupError
                    ? "border-border-danger"
                    : "border-surface-border-strong focus-within:border-brand-accent"
                }`}
              >
                {groupTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#b8d4ea] bg-[#deeef9] py-0.5 pl-1.5 pr-1 font-mono text-[11.5px] font-medium text-[#1a4a6b] transition-colors hover:bg-[#cce3f4]"
                  >
                    <OrcidLogo size={12} />
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeGroupTag(tag); }}
                      aria-label={`Eliminar ${tag}`}
                      className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#1a4a6b]/50 transition-colors hover:bg-[#1a4a6b]/15 hover:text-[#1a4a6b]"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  ref={groupInputRef}
                  type="text"
                  value={groupRawInput}
                  onChange={handleGroupRawChange}
                  onKeyDown={handleGroupTagKeyDown}
                  onPaste={handleGroupPaste}
                  placeholder={
                    groupTags.length === 0
                      ? "Pega o escribe ORCID iDs separados por comas, espacios o saltos de línea"
                      : ""
                  }
                  className="min-w-[200px] flex-1 bg-transparent font-mono text-[13px] text-ink-primary outline-none placeholder:text-ink-tertiary/60"
                />
              </div>

              {groupError && (
                <p className="mt-1 text-xs text-ink-danger">{groupError}</p>
              )}

              <button
                type="button"
                onClick={handleGroupSearch}
                disabled={groupLoading || groupTags.length === 0}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  groupTags.length > 0
                    ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
                    : "border border-surface-border bg-surface-secondary text-ink-tertiary"
                }`}
              >
                {groupLoading && <Spinner size={14} />}
                <UsersIcon size={14} />
                {groupLoading
                  ? "Preparando..."
                  : groupTags.length > 1
                    ? `Buscar ${groupTags.length} investigadores`
                    : "Buscar investigadores"}
              </button>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
