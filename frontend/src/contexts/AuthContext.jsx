import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "orcid_auth_token";

// Message type sent by AuthCallbackPage (runs in the OAuth popup)
// to notify the parent window that authentication succeeded.
export const AUTH_MESSAGE_TYPE = "ORCID_AUTH_TOKEN";
export const AUTH_ERROR_TYPE = "ORCID_AUTH_ERROR";

const AuthContext = createContext(null);

function extractOrcidFromToken(token) {
  if (!token) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Provides JWT-based authentication state throughout the app.
 *
 * Authentication flow (OAuth 3-legged):
 *   1. User clicks "Iniciar sesión" → frontend opens popup at
 *      GET /api/auth/orcid/authorize.
 *   2. Backend redirects to ORCID (sandbox or production).
 *   3. User authenticates at orcid.org.
 *   4. ORCID redirects to ORCID_REDIRECT_URI (= frontend /auth/callback).
 *   5. AuthCallbackPage exchanges the `code` for a JWT via the backend.
 *   6. Popup sends postMessage({ type: "ORCID_AUTH_TOKEN", token }) to
 *      opener and closes itself.
 *   7. This provider's message listener stores the token and updates state.
 *
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));

  // Listen for messages from the OAuth popup window.
  useEffect(() => {
    function handleMessage(event) {
      // Only accept messages from the same origin (the React app itself,
      // running in the popup after the OAuth redirect lands there).
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === AUTH_MESSAGE_TYPE && event.data?.token) {
        localStorage.setItem(STORAGE_KEY, event.data.token);
        setToken(event.data.token);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /**
   * Stores a JWT directly (used by AuthCallbackPage).
   * Does NOT trigger any network request.
   */
  const storeToken = useCallback((accessToken) => {
    localStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      userOrcidId: extractOrcidFromToken(token),
      storeToken,
      logout,
    }),
    [token, storeToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
