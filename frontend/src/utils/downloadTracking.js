/**
 * Helpers for per-user "new publication" (not yet downloaded) tracking.
 * Backend sets `downloaded_by_me` when a Bearer token is present; these
 * utilities keep the dashboard in sync after login and export.
 */

/** True when an authenticated user needs a refetch to obtain download flags. */
export function publicationsNeedDownloadFlags(publications, isAuthenticated) {
  if (!isAuthenticated || !publications?.length) return false;
  return publications.some((p) => p.downloaded_by_me == null);
}

/** Mark the given publication IDs as downloaded in local state. */
export function markPublicationsAsDownloaded(publications, downloadedIds) {
  if (!downloadedIds?.length || !publications?.length) return publications;
  const ids = new Set(downloadedIds);
  return publications.map((p) =>
    ids.has(p.id) ? { ...p, downloaded_by_me: true } : p,
  );
}

/** Apply download flags across group-search result bundles. */
export function markGroupResultsAsDownloaded(results, downloadedIds) {
  if (!downloadedIds?.length || !results?.length) return results;
  const ids = new Set(downloadedIds);
  return results.map((bundle) => ({
    ...bundle,
    publications: (bundle.publications ?? []).map((p) =>
      ids.has(p.id) ? { ...p, downloaded_by_me: true } : p,
    ),
  }));
}
