/**
 * Temporary in-memory fixtures used while the FastAPI backend is still being
 * built by the backend team. Once the real endpoints are live, the
 * `useMockApi` flag in `api.js` callers can be flipped off and this file
 * can be deleted.
 */
export const MOCK_RESEARCHER = {
  orcid_id: "0000-0002-1234-5678",
  name: "Dra. María García",
  affiliation: "Universidad Complutense de Madrid",
  last_sync_at: "2026-04-15T10:30:00Z",
};

export const MOCK_PUBLICATIONS = [
  {
    id: "uuid-1",
    title: "Machine Learning in Quantum Computing",
    journal: "Nature Physics",
    publication_year: 2025,
    doi: "10.1038/s41567-025-xxxx",
    type: "journal-article",
  },
  {
    id: "uuid-2",
    title:
      "A review of SWORD protocol integrations in institutional repositories",
    journal: "Journal of Digital Repositories",
    publication_year: 2024,
    doi: "10.1000/jdr.2024.12",
    type: "review",
  },
  {
    id: "uuid-3",
    title: "Open Access Policies and Compliance in European Universities",
    journal: "Scientometrics",
    publication_year: 2024,
    doi: "10.1007/s11192-024-04801-z",
    type: "journal-article",
  },
  {
    id: "uuid-4",
    title: "Automated Metadata Harvesting via OAI-PMH",
    journal: "Digital Libraries Conference Proceedings",
    publication_year: 2023,
    doi: "10.1145/3587-dl.2023.09",
    type: "conference-paper",
  },
  {
    id: "uuid-5",
    title: "Interoperability Standards for Research Information Systems",
    journal: "International Journal of Library Science",
    publication_year: 2023,
    doi: "10.1016/j.ijls.2023.03.011",
    type: "journal-article",
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
  return {
    ...MOCK_RESEARCHER,
    orcid_id: orcidId,
    last_sync_at: new Date().toISOString(),
  };
}

export async function mockExport(format) {
  await delay(1200);
  return { format };
}
