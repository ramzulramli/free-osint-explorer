import runInvestigation from "./investigation-engine.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonError(stage, error, status = 500) {
  const safeStatus = Number.isInteger(status) && status >= 200 && status <= 599 ? status : 500;
  return Response.json(
    { status: "error", stage, message: error?.message || String(error || "Unknown worker error") },
    { status: safeStatus, headers: CORS_HEADERS }
  );
}

async function loadApp() {
  const module = await import("./investigate.js");
  return module.default;
}

async function normalizeAppResponse(value, { html = false } = {}) {
  if (value instanceof Response) return value;
  if (html) {
    if (typeof value === "string") return new Response(value, { status: 200, headers: { ...CORS_HEADERS, "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" } });
    throw new Error("Application root returned an unsupported value");
  }
  if (value !== null && typeof value === "object") return Response.json(value, { status: 200, headers: CORS_HEADERS });
  if (typeof value === "string") return new Response(value, { status: 200, headers: { ...CORS_HEADERS, "content-type": "text/plain; charset=UTF-8" } });
  throw new Error("Application returned an unsupported value");
}

async function handleRoot(request, env, ctx, app) {
  const raw = await app.fetch(request, env, ctx);
  const response = await normalizeAppResponse(raw, { html: true });
  const headers = new Headers(response.headers);
  if (!(headers.get("content-type") || "").includes("text/html")) return response;
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
    try {
      const url = new URL(request.url);
      if (url.pathname === "/investigate") {
        const subject = url.searchParams.get("q")?.trim();
        if (!subject) return Response.json({ status: "error", message: "Missing investigation query", usage: "/investigate?q=Name&depth=1" }, { status: 400, headers: CORS_HEADERS });
        const provider = url.searchParams.get("provider")?.trim().toLowerCase() || null;
        const depth = url.searchParams.get("depth") || "1";
        return Response.json(await runInvestigation(subject, env, provider, depth), { status: 200, headers: CORS_HEADERS });
      }
      const app = await loadApp();
      if (!app || typeof app.fetch !== "function") throw new Error("investigate.js did not export a valid fetch handler");
      if (url.pathname === "/") return await handleRoot(request, env, ctx, app);
      return await normalizeAppResponse(await app.fetch(request, env, ctx));
    } catch (error) {
      return jsonError("worker-fetch", error, 500);
    }
  },
};
