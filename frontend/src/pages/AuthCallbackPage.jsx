import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Spinner } from "../components/ui/Spinner";
import { AlertIcon, CheckIcon } from "../components/ui/Icons";
import { exchangeOrcidCode } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AUTH_MESSAGE_TYPE, AUTH_ERROR_TYPE } from "../contexts/AuthContext";

/**
 * OAuth callback page — mounted at /callback.
 *
 * ORCID redirects here after the user authenticates. We extract the
 * authorization `code`, exchange it for a JWT via the backend, store
 * the token and — if running inside a popup — notify the opener and
 * close the window. Otherwise we navigate back to the landing page.
 *
 * For this page to be reached, the backend's ORCID_REDIRECT_URI env var
 * must be set to <frontend-origin>/callback, e.g.:
 *   ORCID_REDIRECT_URI=http://localhost:5173/callback
 */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { storeToken } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const hasHandledCodeRef = useRef(false);

  useEffect(() => {
    // React StrictMode may remount components in development. OAuth codes
    // are single-use, so a second exchange attempt triggers backend errors.
    // This in-memory guard handles duplicate effect runs in same mount.
    if (hasHandledCodeRef.current) return;
    hasHandledCodeRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // User denied access at ORCID
    if (oauthError) {
      const msg =
        errorDescription ??
        (oauthError === "access_denied"
          ? "Acceso denegado en ORCID."
          : `Error OAuth: ${oauthError}`);
      setStatus("error");
      setErrorMsg(msg);
      notifyAndClose({ type: AUTH_ERROR_TYPE, error: msg });
      return;
    }

    if (!code) {
      const msg = "No se recibió el código de autorización de ORCID.";
      setStatus("error");
      setErrorMsg(msg);
      notifyAndClose({ type: AUTH_ERROR_TYPE, error: msg });
      return;
    }

    // Persistent dedupe across remounts/reloads in the popup.
    const consumedKey = `orcid_oauth_code_consumed:${code}`;
    if (sessionStorage.getItem(consumedKey) === "1") {
      setStatus("success");
      notifyAndClose({ type: AUTH_MESSAGE_TYPE });
      return;
    }
    sessionStorage.setItem(consumedKey, "1");

    exchangeOrcidCode(code, { state })
      .then(({ access_token }) => {
        storeToken(access_token);
        setStatus("success");
        notifyAndClose({ type: AUTH_MESSAGE_TYPE, token: access_token });
      })
      .catch((err) => {
        // Allow re-trying if the first attempt failed before code exchange
        // actually happened on the backend (network cut, popup close, etc.).
        sessionStorage.removeItem(consumedKey);
        const msg = err?.message ?? "No se pudo completar el inicio de sesión.";
        setStatus("error");
        setErrorMsg(msg);
        notifyAndClose({ type: AUTH_ERROR_TYPE, error: msg });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a short delay, always attempt window.close():
  //  - If we're in the OAuth popup (opened by window.open()), the browser
  //    allows close() and the window disappears.
  //  - If the window doesn't close (browser blocked it, or the user opened
  //    /callback directly as a plain tab), we detect that via window.closed
  //    and fall back to navigating to "/" so the user sees the landing page.
  //
  // NOTE: Neither window.opener nor window.name are reliable here.
  //   - window.name is cleared by Chrome on cross-origin navigation
  //     (our domain → sandbox.orcid.org → our domain clears the name).
  //   - window.opener is severed by ORCID Sandbox's own COOP header
  //     while the popup passes through their domain.
  useEffect(() => {
    if (status !== "success" && status !== "error") return;
    const outer = setTimeout(() => {
      window.close();
      // Give the browser a tick to process the close. If the window
      // is still open, we're in a plain tab — navigate to home instead.
      setTimeout(() => {
        if (!window.closed) navigate("/");
      }, 300);
    }, 1500);
    return () => clearTimeout(outer);
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-tertiary p-8 text-center">
      {status === "loading" && (
        <>
          <Spinner size={32} />
          <div>
            <p className="text-base font-medium text-ink-primary">
              Completando inicio de sesión...
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              Verificando credenciales con ORCID.
            </p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckIcon size={28} />
          </div>
          <div>
            <p className="text-base font-medium text-ink-primary">
              ¡Sesión iniciada correctamente!
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              Cerrando ventana...
            </p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500">
            <AlertIcon size={28} />
          </div>
          <div>
            <p className="text-base font-medium text-ink-primary">
              Error al iniciar sesión
            </p>
            <p className="mt-1 text-sm text-ink-secondary">{errorMsg}</p>
            <p className="mt-2 text-xs text-ink-tertiary">
              Cerrando ventana...
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Helpers ───────────────────────────── */

/**
 * If running in a popup, posts a message to the opener so the parent
 * window can update its auth state without waiting for the storage event
 * fallback in AuthContext. The actual `window.close()` is handled by the
 * delayed effect above so we don't race with the success/error UI.
 *
 * `window.opener` may be `null` here when the browser severed the opener
 * relationship during the OAuth redirect chain (some COOP combinations
 * trigger this). In that case AuthContext picks up the new token via the
 * `storage` event instead — that's why we still call `storeToken()` even
 * when we can't postMessage.
 */
function notifyAndClose(message) {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(message, window.location.origin);
    } catch {
      /* opener may have navigated away */
    }
  }
}

export default AuthCallbackPage;
