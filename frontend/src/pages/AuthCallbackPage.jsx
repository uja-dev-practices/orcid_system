import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Spinner } from "../components/ui/Spinner";
import { AlertIcon, CheckIcon } from "../components/ui/Icons";
import { exchangeOrcidCode } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AUTH_MESSAGE_TYPE, AUTH_ERROR_TYPE } from "../contexts/AuthContext";

/**
 * OAuth callback page — mounted at /auth/callback.
 *
 * ORCID redirects here after the user authenticates. We extract the
 * authorization `code`, exchange it for a JWT via the backend, store
 * the token and — if running inside a popup — notify the opener and
 * close the window. Otherwise we navigate back to the landing page.
 *
 * For this page to be reached, the backend's ORCID_REDIRECT_URI env var
 * must be set to <frontend-origin>/auth/callback, e.g.:
 *   ORCID_REDIRECT_URI=http://localhost:5173/auth/callback
 */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { storeToken } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
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

    exchangeOrcidCode(code)
      .then(({ access_token }) => {
        storeToken(access_token);
        setStatus("success");
        notifyAndClose({ type: AUTH_MESSAGE_TYPE, token: access_token });
      })
      .catch((err) => {
        const msg = err?.message ?? "No se pudo completar el inicio de sesión.";
        setStatus("error");
        setErrorMsg(msg);
        notifyAndClose({ type: AUTH_ERROR_TYPE, error: msg });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a short delay, redirect to home if we're NOT in a popup
  // (fallback for browsers that block window.open).
  useEffect(() => {
    if (status === "success" || status === "error") {
      const isPopup = Boolean(window.opener);
      if (!isPopup) {
        const timer = setTimeout(() => navigate("/"), 2000);
        return () => clearTimeout(timer);
      }
    }
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
 * If running in a popup, posts a message to the opener and closes the
 * window. If not in a popup (e.g. browser blocked it), the message is
 * irrelevant — the useEffect above handles the redirect to "/".
 */
function notifyAndClose(message) {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(message, window.location.origin);
    } catch {
      /* opener may have navigated away */
    }
    // Small delay so the user sees the success/error state before close.
    setTimeout(() => window.close(), 1200);
  }
}

export default AuthCallbackPage;
