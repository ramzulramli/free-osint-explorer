const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonError(stage, error, status = 500) {
  const safeStatus = Number.isInteger(status) && status >= 200 && status <= 599 ? status : 500;
  return Response.json(
    {
      status: "error",
      stage,
      message: error?.message || String(error || "Unknown worker error"),
    },
    { status: safeStatus, headers: CORS_HEADERS }
  );
}

async function loadApp() {
  const module = await import("./investigate.js");
  return module.default;
}

async function handleRoot(request, env, ctx, app) {
  const response = await app.fetch(request, env, ctx);
  if (!(response instanceof Response)) {
    return Response.json({ status: "error", stage: "root", message: "Application returned an invalid response" }, { status: 500, headers: CORS_HEADERS });
  }

  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = (await response.text())
    .replace('placeholder="e.g. Ramzul Mazwan Ramli"', 'placeholder="Enter a name or search term..."')
    .replace(
      "Free public-source workflow • bounded search depth to control cost and noise",
      "Search a person, organisation, username or keyword • bounded search depth to control cost and noise"
    );

  headers.set("content-type", "text/html; charset=UTF-8");
  headers.set("cache-control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(html, {
    status: response.status >= 200 && response.status <= 599 ? response.status : 200,
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
      if (!app || typeof app.fetch !== "function") {
        throw new Error("investigate.js did not export a valid fetch handler");
      }
    } catch (error) {
      return jsonError("module-load", error, 500);
    }

    try {
      const url = new URL(request.url);
      const response = url.pathname === "/"
        ? await handleRoot(request, env, ctx, app)
        : await app.fetch(request, env, ctx);

      if (!(response instanceof Response)) {
        return jsonError("invalid-response", new Error("Application returned a non-Response value"), 500);
      }

      // Do not reconstruct the response body. Returning the original Response
      // avoids consuming/losing its ReadableStream in the Worker runtime.
      return response;
    } catch (error) {
      return jsonError("worker-fetch", error, 500);
    }
  },
};
