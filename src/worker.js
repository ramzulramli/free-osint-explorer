import app from "./investigate.js";

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

async function handleRoot(request, env, ctx) {
  const response = await app.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  let html = await response.text();

  // Keep the public UI neutral: no personal/family name is pre-filled or suggested.
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

    const url = new URL(request.url);
    const response = url.pathname === "/"
      ? await handleRoot(request, env, ctx)
      : await app.fetch(request, env, ctx);

    return withCors(response);
  },
};
