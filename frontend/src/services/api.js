/**
 * Cliente HTTP del frontend contra la API FastAPI.
 *
 * Cada función devuelve el JSON ya parseado (o un Blob para descargas)
 * y lanza `ApiError` en respuestas no 2xx, de forma que cada pantalla
 * decide cómo mostrarlo (toast, error inline, reintento, …).
 *
 * La URL base se inyecta en build via `VITE_API_URL` (ver `.env.example`).
 * En desarrollo la dejamos en blanco para que las peticiones pasen por
 * el proxy de Vite (ver `vite.config.js`) y así eludir CORS mientras el
 * backend no lo tenga configurado.
 *
 * Contrato real del backend (prefijo de router: `/researchers`):
 *   - POST   /researchers/?orcid_id=XXXX-XXXX-XXXX-XXXX    (crea/upsert)
 *   - GET    /researchers/{orcid_id}
 *   - POST   /researchers/{orcid_id}/sync
 *   - GET    /researchers/{orcid_id}/publications
 *   - GET    /researchers/{orcid_id}/export/sword.xml
 *   - GET    /researchers/{orcid_id}/export/sword.zip
 */

import {
  mockExport,
  mockGetPublications,
  mockSyncResearcher,
  mockValidateOrcid,
} from "./mocks";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
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
      /* sin cuerpo JSON */
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

/* ───────────────────────────── Mapeos ────────────────────────────── */

/**
 * Adapta el esquema del backend (`pub_year`, campos opcionalmente `null`)
 * al que espera la UI (`publication_year`, strings seguras para filtrar).
 */
function normalizePublication(p) {
  return {
    id: p.id,
    put_code: p.put_code ?? null,
    title: p.title || "Sin título",
    journal: p.journal || "",
    doi: p.doi || "",
    publication_year: p.pub_year ?? null,
    type: p.type || null,
    hash_fingerprint: p.hash_fingerprint ?? null,
    last_modified: p.last_modified ?? null,
  };
}

/* ───────────────────────────── Endpoints ─────────────────────────────── */

/**
 * Asegura que el investigador existe en el backend y devuelve su ficha
 * completa.
 *
 * Como el backend no expone un endpoint de validación puro, hacemos:
 *   1. POST /researchers/?orcid_id=... (idempotente: crea o devuelve el
 *      existente; valida formato + dígito de control en el servidor).
 *   2. GET  /researchers/{orcid_id}    (para recuperar el objeto completo:
 *      name, last_sync_at, etc.).
 */
export async function validateOrcid(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockValidateOrcid(orcidId);

  await request(
    `/researchers/?orcid_id=${encodeURIComponent(orcidId)}`,
    { method: "POST", signal },
  );
  return request(`/researchers/${encodeURIComponent(orcidId)}`, { signal });
}

/** GET /researchers/{orcid}/publications — normalizado para la UI. */
export async function getPublications(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockGetPublications(orcidId);

  const raw = await request(
    `/researchers/${encodeURIComponent(orcidId)}/publications`,
    { signal },
  );
  return Array.isArray(raw) ? raw.map(normalizePublication) : [];
}

/**
 * POST /researchers/{orcid}/sync — dispara el re-harvest desde ORCID.
 *
 * El backend devuelve un resumen del job (`{status, message, new_records,
 * updated_records, total, researcher}`), no el researcher completo.
 * El caller debe refetch-ear el researcher y sus publicaciones.
 */
export function syncResearcher(orcidId, { signal } = {}) {
  if (USE_MOCKS) return mockSyncResearcher(orcidId);

  return request(`/researchers/${encodeURIComponent(orcidId)}/sync`, {
    method: "POST",
    signal,
  });
}

/**
 * Construye la URL pública de exportación para enlaces directos
 * (sin pasar por `fetch`). La usa el dropdown de exportación.
 */
export function getExportUrl(orcidId, format) {
  return `${BASE_URL}/researchers/${encodeURIComponent(orcidId)}/export/sword.${format}`;
}

/**
 * Descarga una exportación como Blob (para forzar descarga programática).
 *
 * `publicationIds` es opcional; si se pasa un array no vacío, el backend
 * filtra el export a sólo esas publicaciones (exportación selectiva). Si
 * se omite o va vacío/null, se exporta el conjunto completo.
 *
 * Usamos POST (no GET) porque los IDs pueden ser cientos y no caben
 * cómodamente en la query-string.
 *
 * Lanza `ApiError` en fallo.
 */
export async function downloadExport(
  orcidId,
  format,
  { signal, publicationIds } = {},
) {
  if (USE_MOCKS) {
    await mockExport(format);
    return { blob: null, url: getExportUrl(orcidId, format) };
  }

  const url = getExportUrl(orcidId, format);
  const ids =
    Array.isArray(publicationIds) && publicationIds.length > 0
      ? publicationIds
      : null;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify({ publication_ids: ids }),
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw new ApiError("No se pudo contactar con el servidor.", {
      status: 0,
      payload: { cause: String(cause) },
    });
  }
  if (!response.ok) {
    throw new ApiError(
      `No se pudo exportar el fichero ${format.toUpperCase()}.`,
      { status: response.status },
    );
  }
  const blob = await response.blob();
  return { blob, url };
}
