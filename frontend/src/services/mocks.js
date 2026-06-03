/**
 * Temporary in-memory fixtures used while el backend está apagado o
 * mientras se trabaja sin red. Se activan poniendo
 * `VITE_USE_MOCKS=true` en `.env`. Una vez el backend esté siempre
 * disponible, este fichero puede borrarse junto a las ramas
 * `if (USE_MOCKS) …` de `api.js`.
 *
 * Los objetos siguen la forma que la UI espera (post-normalización),
 * porque las funciones de `api.js` los devuelven directamente sin
 * volver a pasar por el mapper. Si en el futuro queremos imitar el
 * payload crudo del backend (`pub_year`, etc.), habrá que hacerlas
 * pasar por `normalizePublication` en el lado del servicio.
 */
export const MOCK_RESEARCHER = {
  orcid_id: "0000-0002-1234-5678",
  name: "Dra. María García",
  authenticated: false,
  affiliation: "Universidad Complutense de Madrid",
  last_sync_at: "2026-04-15T10:30:00Z",
};

export const MOCK_PUBLICATIONS = [
  {
    id: "uuid-1",
    put_code: 1000001,
    title: "Machine Learning in Quantum Computing",
    journal: "Nature Physics",
    publication_year: 2025,
    doi: "10.1038/s41567-025-xxxx",
    type: "journal-article",
    last_modified: "2025-09-01T10:00:00Z",
    downloaded_by_me: false,
  },
  {
    id: "uuid-2",
    put_code: 1000002,
    title:
      "A review of SWORD protocol integrations in institutional repositories",
    journal: "Journal of Digital Repositories",
    publication_year: 2024,
    doi: "10.1000/jdr.2024.12",
    type: "review",
    last_modified: "2024-11-12T09:00:00Z",
    downloaded_by_me: false,
  },
  {
    id: "uuid-3",
    put_code: 1000003,
    title: "Open Access Policies and Compliance in European Universities",
    journal: "Scientometrics",
    publication_year: 2024,
    doi: "10.1007/s11192-024-04801-z",
    type: "journal-article",
    last_modified: "2024-06-20T15:30:00Z",
    downloaded_by_me: true,
  },
  {
    id: "uuid-4",
    put_code: 1000004,
    title: "Automated Metadata Harvesting via OAI-PMH",
    journal: "Digital Libraries Conference Proceedings",
    publication_year: 2023,
    doi: "10.1145/3587-dl.2023.09",
    type: "conference-paper",
    last_modified: "2023-10-05T11:45:00Z",
    downloaded_by_me: false,
  },
  {
    id: "uuid-5",
    put_code: 1000005,
    title: "Interoperability Standards for Research Information Systems",
    journal: "International Journal of Library Science",
    publication_year: 2023,
    doi: "10.1016/j.ijls.2023.03.011",
    type: "journal-article",
    last_modified: "2023-04-18T08:15:00Z",
    downloaded_by_me: true,
  },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function mockValidateOrcid(orcidId) {
  await delay(700);
  return { ...MOCK_RESEARCHER, orcid_id: orcidId };
}

export async function mockGetPublications(/* orcidId */) {
  await delay(600);
  return MOCK_PUBLICATIONS;
}

export async function mockSyncResearcher(orcidId) {
  await delay(1800);
  // Imita el resumen del SyncJob real (`new_records`, `updated_records`,
  // `total`). El bundle completo lo reconstruye `api.js` a partir de
  // este objeto + las publicaciones mock.
  return {
    status: "ok",
    message: "Sincronización completada correctamente.",
    researcher: orcidId,
    new_records: 0,
    updated_records: MOCK_PUBLICATIONS.length,
    total: MOCK_PUBLICATIONS.length,
  };
}

export async function mockExport(format) {
  await delay(1200);
  return { format };
}
