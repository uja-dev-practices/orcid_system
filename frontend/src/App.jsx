import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "./contexts/AuthContext";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GroupResultsPage } from "./pages/GroupResultsPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";

/**
 * App shell. Declares the top-level routes and mounts the global
 * notification portal (sonner). Router itself lives in `main.jsx` so tests
 * can wrap `<App />` with a `MemoryRouter` if needed.
 */
export default function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    const updateViewport = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard/:orcid" element={<DashboardPage />} />
        <Route path="/group" element={<GroupResultsPage />} />
        <Route path="/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position={isMobile ? "bottom-center" : "bottom-right"}
        richColors
        closeButton
        expand
        theme="light"
        visibleToasts={4}
        offset={20}
        mobileOffset={{ bottom: 12, left: 12, right: 12 }}
        toastOptions={{ duration: 4000 }}
        style={{
          /* SUCCESS — ORCID corporate green */
          "--success-bg": "#EAF3DE",
          "--success-border": "#C0DD97",
          "--success-text": "#3B6D11",
          /* ERROR — hue-0° mirror of the ORCID green (same saturation & lightness) */
          "--error-bg": "#F3DDDD",
          "--error-border": "#DD9797",
          "--error-text": "#6E1111",
        }}
      />
    </AuthProvider>
  );
}
