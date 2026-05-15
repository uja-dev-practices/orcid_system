import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

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
    return prefix;
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
