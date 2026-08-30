const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(stage, error, status = 500) {
  return Response.json(
    {
      status: "error",
      stage,
      message: error?.message || String(error || "Unknown worker error"),
    },
    { status, headers: CORS_HEADERS }
  );
}

async function loadApp() {
  const module = await import("./investigate.js");
  return module.default;
}

async function handleRoot(request, env, ctx, app) {
  const response = await app.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  let html = await response.text();

  html = html
    .replace('placeholder="e.g. Ramzul Mazwan Ramli"', 'placeholder="Enter a name or search term..."')
    .replace(
      "Free public-source workflow • bounded search depth to control cost and noise",
      "Search a person, organisation, username or keyword • bounded search depth to control cost and noise"
    );

  headers.set("content-type", "text/html; charset=UTF-8");
  headers.set("cache-control", "no-store");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    let app;
    try {
      app = await loadApp();
    } catch (error) {
      return jsonError("module-load", error, 500);
    }

    try {
      const url = new URL(request.url);
      const response = url.pathname === "/"
        ? await handleRoot(request, env, ctx, app)
        : await app.fetch(request, env, ctx);

      return withCors(response);
    } catch (error) {
      return jsonError("worker-fetch", error, 500);
    }
  },
};
