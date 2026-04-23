/**
 * Thin API client for the FastAPI backend.
 *
 * Every call returns parsed JSON (or a Blob for file downloads) and throws
 * an `ApiError` on non-2xx responses so callers can decide how to surface it
 * (toast, inline error, retry, etc.).
 *
 * The base URL is injected at build time via `VITE_API_URL`
 * (see `.env.example`). During development, leaving it blank falls back to
 * same-origin requests, which plays well with a Vite proxy.
 */

import {
  mockExport,
  mockGetPublications,
  mockSyncResearcher,
  mockValidateOrcid,
} from "./mocks";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/**
 * When the backend is not available yet, set `VITE_USE_MOCKS=true` in your
 * `.env.local` to route every call through `mocks.js`. In production this
 * flag MUST be unset.
 */
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = "GET", body, signal, headers } = {}) {
  const url = `${BASE_URL}${path}`;
  const init = {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new ApiError("No se pudo contactar con el servidor.", {
      status: 0,
      payload: { cause: String(cause) },
    });
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      /* response had no JSON body */
    }
    const detail =
      payload?.detail ?? payload?.message ?? response.statusText ?? "Error";
    throw new ApiError(typeof detail === "string" ? detail : "Error de API", {
      status: response.status,
      payload,
    });
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response;
}

/* ───────────────────────────── Endpoints ─────────────────────────────── */

/** POST /api/orcid/validate — validates an ORCID iD and returns the researcher. */
export function validateOrcid(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockValidateOrcid(orcidId);
  return request("/api/orcid/validate", {
    method: "POST",
    body: { orcid_id: orcidId },
    signal,
  });
}

/** GET /api/researchers/{orcid}/publications — lists ORCID works. */
export function getPublications(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockGetPublications(orcidId);
  return request(
    `/api/researchers/${encodeURIComponent(orcidId)}/publications`,
    { signal },
  );
}

/** POST /api/researchers/{orcid}/sync — triggers ORCID re-harvest. */
export function syncResearcher(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockSyncResearcher(orcidId);
  return request(`/api/researchers/${encodeURIComponent(orcidId)}/sync`, {
    method: "POST",
    signal,
  });
}

/**
 * Builds the public export URL so links/anchors can download files directly
 * without going through `fetch`. Used by the export dropdown.
 */
export function getExportUrl(orcidId, format) {
  return `${BASE_URL}/api/researchers/${encodeURIComponent(orcidId)}/export/sword.${format}`;
}

/**
 * Downloads an export as a Blob (useful when we want to trigger a
 * programmatic file download). Falls back to `ApiError` on failure.
 */
export async function downloadExport(orcidId, format, { signal } = {}) {
  if (USE_MOCKS) {
    await mockExport(format);
    return { blob: null, url: getExportUrl(orcidId, format) };
  }
  const url = getExportUrl(orcidId, format);
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (cause) {
    throw new ApiError("No se pudo contactar con el servidor.", {
      status: 0,
      payload: { cause: String(cause) },
    });
  }
  if (!response.ok) {
    throw new ApiError(`No se pudo exportar el fichero ${format.toUpperCase()}.`, {
      status: response.status,
    });
  }
  const blob = await response.blob();
  return { blob, url };
}
