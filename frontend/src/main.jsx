import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

/**
 * `import.meta.env.BASE_URL` es fijo en build (p. ej. `/orcid2words/` en prod).
 * Los assets siguen bajo ese prefijo, pero la URL del documento puede ser `/`
 * (acceso directo `http://host:8073/`). React Router exige que el pathname
 * empiece por el basename; si no, no renderiza nada.
 */
function resolveRouterBasename() {
  const configured = import.meta.env.BASE_URL ?? "/";
  const withSlash = configured.endsWith("/") ? configured : `${configured}/`;

  if (withSlash === "/") {
    return "/";
  }

  const { pathname } = window.location;
  if (pathname === "/" || pathname === "") {
    return "/";
  }

  const prefix = withSlash.replace(/\/$/, "");
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return withSlash;
  }

  return "/";
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={resolveRouterBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
