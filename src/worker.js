const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonError(stage, error, status = 500) {
  const safeStatus = Number.isInteger(status) && status >= 200 && status <= 599 ? status : 500;
  return Response.json({
    status: "error",
    stage,
    message: error?.message || String(error || "Unknown worker error"),
  }, { status: safeStatus, headers: CORS_HEADERS });
}

async function loadApp() {
  const module = await import("./investigate.js");
  return module.default;
}

async function normalizeAppResponse(value, { html = false } = {}) {
  if (value instanceof Response) return value;
  if (html) {
    if (typeof value === "string") return new Response(value, {
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" },
    });
    throw new Error("Application root returned an unsupported value");
  }
  if (value !== null && typeof value === "object") return Response.json(value, { status: 200, headers: CORS_HEADERS });
  if (typeof value === "string") return new Response(value, { status: 200, headers: { ...CORS_HEADERS, "content-type": "text/plain; charset=UTF-8" } });
  throw new Error("Application returned an unsupported value");
}

function tokens(value) {
  return String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).filter(x => x !== "bin" && x !== "binti");
}

function tokenSimilarity(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return 0;
  const overlap = x.filter(t => y.includes(t)).length;
  return overlap / Math.max(x.length, y.length);
}

function evidenceBasedConfidence(candidate, data) {
  const name = candidate?.name || data?.subject || data?.query || "";
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  const own = evidence.filter(e => Array.isArray(e.sources) && e.sources.some(s =>
    Array.isArray(candidate?.sources) && candidate.sources.some(cs => cs?.url === s?.url)
  ));

  const nameMatches = own.filter(e => e.type === "person_candidate" && tokenSimilarity(e.value, name) >= 0.75);
  const accounts = Array.isArray(candidate?.signals?.accounts) ? candidate.signals.accounts : [];
  const organisations = Array.isArray(candidate?.signals?.organisations) ? candidate.signals.organisations : [];
  const locations = Array.isArray(candidate?.signals?.locations) ? candidate.signals.locations : [];
  const emails = own.filter(e => e.type === "email");
  const phones = own.filter(e => e.type === "phone");

  const sourceCount = Math.min(5, new Set((candidate?.sources || []).map(s => s?.url).filter(Boolean)).size);
  const independentSourceSignal = Math.min(0.15, Math.max(0, sourceCount - 1) * 0.0375);
  const nameSignal = nameMatches.length ? 0.35 : 0;
  const accountSignal = Math.min(0.20, accounts.length * 0.10);
  const organisationSignal = Math.min(0.15, organisations.length * 0.15);
  const locationSignal = Math.min(0.10, locations.length * 0.10);
  const emailSignal = emails.length ? 0.20 : 0;
  const phoneSignal = phones.length ? 0.25 : 0;

  const raw = nameSignal + independentSourceSignal + accountSignal + organisationSignal + locationSignal + emailSignal + phoneSignal;
  const capped = Math.min(0.95, raw);

  let level = "low";
  if (capped >= 0.70) level = "high";
  else if (capped >= 0.45) level = "moderate";

  const reasons = [];
  if (nameMatches.length) reasons.push(`Name corroborated by ${nameMatches.length} evidence item${nameMatches.length === 1 ? "" : "s"}`);
  if (sourceCount > 1) reasons.push(`${sourceCount} distinct source${sourceCount === 1 ? "" : "s"}`);
  if (accounts.length) reasons.push(`${accounts.length} account signal${accounts.length === 1 ? "" : "s"}`);
  if (organisations.length) reasons.push(`${organisations.length} organisation signal${organisations.length === 1 ? "" : "s"}`);
  if (locations.length) reasons.push(`${locations.length} location signal${locations.length === 1 ? "" : "s"}`);
  if (emails.length) reasons.push("email corroboration");
  if (phones.length) reasons.push("phone corroboration");
  if (!accounts.length && !organisations.length && !locations.length && !emails.length && !phones.length) reasons.push("no independent identity attribute corroborated");

  return { confidence: Number(capped.toFixed(4)), level, reasons };
}

async function enrichInvestigationResponse(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  let data;
  try { data = await response.json(); } catch { return response; }
  if (!data || data.status !== "success" || !Array.isArray(data.summary?.candidates)) {
    return Response.json(data, { status: response.status, headers: { ...CORS_HEADERS, "content-type": "application/json; charset=UTF-8" } });
  }

  const sourceMap = new Map((data.sources || []).map(s => [s.url, s]));
  const candidates = data.summary.candidates.map(candidate => {
    const assessment = evidenceBasedConfidence(candidate, data);
    const sources = (candidate.sources || []).map(source => ({
      ...source,
      read: sourceMap.get(source.url)?.read ?? source.read ?? false,
    }));
    return {
      ...candidate,
      confidence: assessment.confidence,
      assessment,
      sources,
    };
  }).sort((a, b) => b.confidence - a.confidence);

  data.summary.candidates = candidates;
  data.confidence = candidates[0]?.confidence || 0;
  data.assessment = candidates[0]?.assessment || { confidence: 0, level: "low", reasons: ["No identity candidate"] };
  data.evidence = (data.evidence || []).map(item => ({
    ...item,
    sources: (item.sources || []).map(source => ({
      ...source,
      read: sourceMap.get(source.url)?.read ?? source.read ?? false,
    })),
  }));
  data.stats = { ...(data.stats || {}), scoring: "evidence-v2" };

  return Response.json(data, { status: response.status, headers: { ...CORS_HEADERS, "content-type": "application/json; charset=UTF-8" } });
}

async function handleRoot(request, env, ctx, app) {
  const raw = await app.fetch(request, env, ctx);
  const response = await normalizeAppResponse(raw, { html: true });
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const html = (await response.text())
    .replace('placeholder="e.g. Ramzul Mazwan Ramli"', 'placeholder="Enter a name or search term..."')
    .replace("Free public-source workflow • bounded search depth to control cost and noise", "Search a person, organisation, username or keyword • bounded search depth to control cost and noise");
  headers.set("content-type", "text/html; charset=UTF-8");
  headers.set("cache-control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(html, { status: response.status >= 200 && response.status <= 599 ? response.status : 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    let app;
    try {
      app = await loadApp();
      if (!app || typeof app.fetch !== "function") throw new Error("investigate.js did not export a valid fetch handler");
    } catch (error) { return jsonError("module-load", error, 500); }
    try {
      const url = new URL(request.url);
      if (url.pathname === "/") return await handleRoot(request, env, ctx, app);
      const raw = await app.fetch(request, env, ctx);
      const response = await normalizeAppResponse(raw);
      if (url.pathname === "/investigate" && response.status >= 200 && response.status <= 599) return await enrichInvestigationResponse(response);
      return response;
    } catch (error) { return jsonError("worker-fetch", error, 500); }
  },
};