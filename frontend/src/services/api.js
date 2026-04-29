/**
 * Cliente HTTP del frontend contra la API FastAPI.
 *
 * Cada función devuelve el JSON ya parseado (o un Blob para descargas)
 * y lanza `ApiError` en respuestas no 2xx, de forma que cada pantalla
 * decide cómo mostrarlo (toast, error inline, reintento, …).
 *
 * Configuración:
 *   - `VITE_API_URL`: URL base del backend, ya con el prefijo `/api`
 *     (p. ej. `http://localhost:8000/api`). Si se deja vacío, las
 *     peticiones se hacen contra `/api` y las redirige el proxy de
 *     Vite (ver `vite.config.js`).
 *   - `VITE_API_KEY`: clave compartida con el backend, se manda en el
 *     header `X-API-Key` de TODAS las peticiones.
 *
 * Contrato actual del backend (todo bajo `/api`):
 *   - GET    /researchers/search                          → buscador grupal (todo en uno)
 *   - GET    /researchers/search/{orcid_id}               → buscador individual (todo en uno)
 *   - POST   /researchers/{orcid_id}/sync                 → re-sync manual
 *   - POST   /export/sword/publications  body=[ids]       → SWORD XML de selección
 *   - POST   /export/zip/publications    body=[ids]       → ZIP de selección
 *   - GET    /export/sword/researcher/{orcid_id}          → SWORD XML de todo el investigador
 *   - GET    /export/zip/researcher/{orcid_id}            → ZIP de todo el investigador
 */

import {
  mockExport,
  mockGetPublications,
  mockSyncResearcher,
  mockValidateOrcid,
} from "./mocks";

// `VITE_API_URL` puede venir como "" (vacío) en `.env` para usar el proxy
// de Vite. En ese caso no queremos usar string vacío como base, sino `/api`.
const BASE_URL = (import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "/api").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Construye la cabecera base que llevan TODAS las peticiones (incluidas
 * las descargas de blob). Incluye X-API-Key siempre y, si existe un JWT
 * en localStorage, también Authorization: Bearer <token>.
 */
function buildAuthHeaders(extra = {}) {
  if (!API_KEY && import.meta.env.DEV) {
    console.warn(
      "[api] VITE_API_KEY no está definida; las peticiones serán rechazadas por el backend.",
    );
  }
  const token = localStorage.getItem("orcid_auth_token");
  return {
    Accept: "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(path, { method = "GET", body, signal, headers } = {}) {
  const url = `${BASE_URL}${path}`;
  const init = {
    method,
    signal,
    headers: buildAuthHeaders({
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    }),
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
 *
 * Mantenemos también los campos crudos relevantes (`put_code`, `subtitle`,
 * `citation_value`, …) por si una vista futura los necesita sin tener
 * que volver a tocar este mapper.
 */
function normalizePublication(p) {
  return {
    id: p.id,
    put_code: p.put_code ?? null,
    title: p.title || "Sin título",
    subtitle: p.subtitle ?? null,
    journal: p.journal || "",
    doi: p.doi || "",
    publication_year: p.pub_year ?? null,
    publication_month: p.pub_month ?? null,
    publication_day: p.pub_day ?? null,
    type: p.type || null,
    url: p.url ?? null,
    short_description: p.short_description ?? null,
    citation_type: p.citation_type ?? null,
    citation_value: p.citation_value ?? null,
    language_code: p.language_code ?? null,
    country: p.country ?? null,
    external_ids: Array.isArray(p.external_ids) ? p.external_ids : [],
    contributors: Array.isArray(p.contributors) ? p.contributors : [],
    hash_fingerprint: p.hash_fingerprint ?? null,
    last_modified: p.last_modified ?? null,
    status: p.status ?? null,
    downloaded_by_me: p.downloaded_by_me ?? null,
  };
}

/**
 * Normaliza la respuesta unificada `{ researcher, publications, … }` que
 * devuelven tanto el buscador individual como el endpoint de sync.
 * Devuelve siempre la misma forma para que las pantallas no tengan que
 * conocer detalles del backend.
 */
function normalizeResearcherBundle(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      researcher: null,
      publications: [],
      newRecords: 0,
      updatedRecords: 0,
      unchangedRecords: 0,
      totalRecords: 0,
    };
  }
  const publications = Array.isArray(raw.publications)
    ? raw.publications.map(normalizePublication)
    : [];
  return {
    researcher: raw.researcher ?? null,
    publications,
    newRecords: raw.new_records ?? 0,
    updatedRecords: raw.updated_records ?? 0,
    unchangedRecords: raw.unchanged_records ?? 0,
    totalRecords: raw.total_records ?? publications.length,
  };
}

/* ───────────────────────────── Auth ─────────────────────────────── */

/**
 * URL a la que debe redirigirse (o abrirse en popup) para iniciar el
 * flujo OAuth 3-legged de ORCID.
 *
 * Secuencia completa:
 *   1. Frontend abre/redirige a GET /api/auth/orcid/authorize
 *   2. Backend construye la URL de ORCID y redirige al navegador.
 *   3. El usuario se autentica en orcid.org (o sandbox.orcid.org).
 *   4. ORCID redirige a ORCID_REDIRECT_URI (debe apuntar a la página
 *      /auth/callback del frontend).
 *   5. El frontend extrae el `code` y llama a exchangeOrcidCode(code).
 *   6. El backend intercambia el code → access_token y lo devuelve.
 */
export function getOrcidAuthorizeUrl() {
  return `${BASE_URL}/auth/orcid/authorize`;
}

/**
 * GET /auth/orcid/callback?code=<code>
 *
 * Intercambia el authorization code (recibido de ORCID tras el OAuth)
 * por un JWT propio del backend. Devuelve `{ access_token, token_type }`.
 */
export async function exchangeOrcidCode(code, { signal } = {}) {
  return request(
    `/auth/orcid/callback?${new URLSearchParams({ code }).toString()}`,
    { signal },
  );
}

/* ───────────────────────────── Endpoints ─────────────────────────────── */

/**
 * Búsqueda "todo en uno" para 1 investigador.
 */
export async function searchResearcher(orcidId, { signal } = {}) {
  if (USE_MOCKS) {
    const researcher = await mockValidateOrcid(orcidId);
    const publications = await mockGetPublications(orcidId);
    return {
      researcher,
      publications,
      newRecords: 0,
      updatedRecords: 0,
      unchangedRecords: publications.length,
      totalRecords: publications.length,
    };
  }

  const batch = await searchResearchersBulk([orcidId], { signal });
  const first = batch.results?.[0] ?? null;
  if (first) return first;

  const firstError = batch.errors?.[0];
  throw new ApiError(firstError?.detail ?? "No se pudo validar el ORCID iD.", {
    payload: firstError,
  });
}

/**
 * Búsqueda grupal: devuelve `results[]` (uno por cada ORCID) junto a
 * `errors[]` y contadores.
 *
 * Contrato backend:
 *   POST /researchers/search
 *   body: { "orcid_ids": ["id1", "id2"] }
 */
export async function searchResearchersBulk(orcidIds, { signal } = {}) {
  const ids = Array.isArray(orcidIds) ? orcidIds : [orcidIds];
  if (USE_MOCKS) {
    const results = [];
    for (const id of ids) {
      const researcher = await mockValidateOrcid(id);
      const publications = await mockGetPublications(id);
      results.push({
        researcher,
        publications,
        newRecords: 0,
        updatedRecords: 0,
        unchangedRecords: publications.length,
        totalRecords: publications.length,
      });
    }
    return {
      results,
      errors: [],
      totalRequested: ids.length,
      totalProcessed: results.length,
    };
  }

  const raw = await request(`/researchers/search`, {
    method: "POST",
    body: { orcid_ids: ids },
    signal,
  });

  const results = Array.isArray(raw?.results)
    ? raw.results.map(normalizeResearcherBundle)
    : [];

  return {
    results,
    errors: Array.isArray(raw?.errors) ? raw.errors : [],
    totalRequested: raw?.total_requested ?? ids.length,
    totalProcessed: raw?.total_processed ?? results.length,
  };
}

/**
 * POST /researchers/{orcid}/sync — dispara el re-harvest desde ORCID.
 *
 * Ahora devuelve el bundle completo `{ researcher, publications,
 * new_records, updated_records, unchanged_records, total_records }`,
 * así que el caller puede refrescar el dashboard sin volver a pedir
 * las publicaciones por separado.
 */
export async function syncResearcher(orcidId, { signal } = {}) {
  if (USE_MOCKS) {
    const summary = await mockSyncResearcher(orcidId);
    const publications = await mockGetPublications(orcidId);
    return {
      researcher: { orcid_id: orcidId },
      publications,
      newRecords: summary?.new_records ?? 0,
      updatedRecords: summary?.updated_records ?? 0,
      unchangedRecords: 0,
      totalRecords: summary?.total ?? publications.length,
    };
  }

  const raw = await request(
    `/researchers/${encodeURIComponent(orcidId)}/sync`,
    { method: "POST", signal },
  );
  return normalizeResearcherBundle(raw);
}

/* ───────────────────────────── Exportación ───────────────────────────── */

/**
 * Mapa de formatos UI → segmento del path en el backend.
 * `xml` mantiene el nombre histórico que ya usaba la UI (`SWORD XML`)
 * pero apunta al endpoint nuevo `/export/sword/...`.
 */
const EXPORT_PATH_SEGMENT = {
  xml: "sword",
  zip: "zip",
};

function exportSegmentFor(format) {
  const segment = EXPORT_PATH_SEGMENT[format];
  if (!segment) throw new ApiError(`Formato de exportación no soportado: ${format}`);
  return segment;
}

/**
 * URL pública del endpoint que descarga TODO el investigador
 * (`GET /export/{sword|zip}/researcher/{orcid_id}`). La usamos como
 * dato meramente informativo en los toasts de éxito; las descargas
 * reales se disparan vía blob para poder forzar el download.
 *
 * Ojo: estas URLs requieren `X-API-Key`, así que NO sirven como link
 * directo en una etiqueta `<a href>`; las exponemos para mostrarlas o
 * loguearlas, no para navegar.
 */
export function getExportUrl(orcidId, format) {
  const segment = exportSegmentFor(format);
  return `${BASE_URL}/export/${segment}/researcher/${encodeURIComponent(orcidId)}`;
}

/**
 * Descarga una exportación como Blob (para forzar descarga programática).
 *
 * - Si `publicationIds` viene con un array no vacío usamos el endpoint
 *   selectivo `POST /export/{sword|zip}/publications` con body
 *   `["id1", "id2", ...]` (array crudo, tal como espera el backend).
 * - Si viene vacío/undefined usamos el endpoint masivo
 *   `GET /export/{sword|zip}/researcher/{orcid_id}` y descargamos todo.
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

  const segment = exportSegmentFor(format);
  const ids =
    Array.isArray(publicationIds) && publicationIds.length > 0
      ? publicationIds
      : null;

  const url = ids
    ? `${BASE_URL}/export/${segment}/publications`
    : `${BASE_URL}/export/${segment}/researcher/${encodeURIComponent(orcidId)}`;

  const init = {
    method: ids ? "POST" : "GET",
    signal,
    headers: buildAuthHeaders({
      Accept: "*/*",
      ...(ids ? { "Content-Type": "application/json" } : {}),
    }),
  };
  if (ids) init.body = JSON.stringify(ids);

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
    throw new ApiError(
      typeof detail === "string"
        ? detail
        : `No se pudo exportar el fichero ${format.toUpperCase()}.`,
      { status: response.status, payload },
    );
  }
  const blob = await response.blob();
  return { blob, url };
}
