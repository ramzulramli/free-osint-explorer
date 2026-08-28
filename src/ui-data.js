// UI data helpers for the live investigation dashboard.
// Keeps API response normalization separate from the Worker investigation pipeline.

export function investigationEndpoint(query, baseUrl = "") {
  const url = new URL("/investigate", baseUrl || globalThis.location?.origin || "http://localhost");
  url.searchParams.set("query", String(query || "").trim());
  return url.toString();
}

export function normalizeInvestigationResponse(data) {
  const investigation = data?.investigation || {};
  const stats = data?.stats || {};
  return {
    subject: investigation.subject || investigation.query || "Unknown subject",
    query: investigation.query || "",
    confidence: Number(investigation.confidence || 0),
    sources: Array.isArray(data?.sources) ? data.sources : [],
    candidates: Array.isArray(data?.candidates) ? data.candidates : [],
    related: Array.isArray(data?.related) ? data.related : [],
    stats: {
      searchResults: Number(stats.searchResults || 0),
      pagesRead: Number(stats.pagesRead || 0),
      pagesFailed: Number(stats.pagesFailed || 0),
      entitiesFound: Number(stats.entitiesFound || 0)
    },
    search: data?.search || {},
    limits: data?.limits || {}
  };
}

export async function investigateFromUi(query, baseUrl = "") {
  const q = String(query || "").trim();
  if (!q) throw new Error("Enter a person or subject to investigate.");
  const response = await fetch(investigationEndpoint(q, baseUrl), {
    headers: { Accept: "application/json" }
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(data?.error || `Investigation failed (HTTP ${response.status})`);
  }
  return normalizeInvestigationResponse(data);
}
