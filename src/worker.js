import runInvestigation from "./investigation-engine.js";
import enrichWithImages from "./image-evidence.js";

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
  const imagePanel = `<style id="foe-image-style">.foe-images{margin:22px 0;padding:18px;border:1px solid #233149;border-radius:16px;background:#0d1421}.foe-images h3{margin:0 0 12px}.foe-images-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.foe-image{display:block;border:1px solid #233149;border-radius:12px;overflow:hidden;background:#111b2b;color:#edf4ff;text-decoration:none}.foe-image img{display:block;width:100%;height:150px;object-fit:cover}.foe-image div{padding:9px;font-size:12px}.foe-image small{display:block;color:#8fa1ba;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><script>(function(){const originalFetch=window.fetch.bind(window);function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;')}function render(data){if(!data||!Array.isArray(data.images))return;let box=document.getElementById('foe-related-images');if(!box){box=document.createElement('section');box.id='foe-related-images';box.className='foe-images';const host=document.querySelector('main')||document.querySelector('.shell')||document.body;host.appendChild(box)}const images=data.images;if(!images.length){box.innerHTML='<h3>Related Images</h3><div style="color:#8fa1ba">No images found from the investigated source pages.</div>';return}box.innerHTML='<h3>Related Images <span style="font-size:12px;font-weight:400;color:#8fa1ba">'+images.length+' found</span></h3><div class="foe-images-grid">'+images.map(i=>'<a class="foe-image" href="'+esc(i.url)+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="'+esc(i.url)+'" alt="'+esc(i.caption||'Related image')+'" onerror="this.closest(\'.foe-image\').remove()"><div>'+esc(i.caption||'Related image')+'<small>'+esc(i.sourceTitle||i.sourceUrl||'Source')+'</small></div></a>').join('')+'</div>'}window.fetch=async function(){const response=await originalFetch.apply(null,arguments);try{const requestUrl=typeof arguments[0]==='string'?arguments[0]:arguments[0]?.url||'';if(new URL(requestUrl,location.href).pathname==='/investigate'){const clone=response.clone();const data=await clone.json();render(data)}}catch(e){}return response}})();</script>`;
  const html = (await response.text())
    .replace('placeholder="e.g. Ramzul Mazwan Ramli"', 'placeholder="Enter a name or search term..."')
    .replace("Free public-source workflow • bounded search depth to control cost and noise", "Search a person, organisation, username or keyword • bounded search depth to control cost and noise")
    .replace("</body>", `${imagePanel}</body>`);
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
        const investigation = await runInvestigation(subject, env, provider, depth);
        return Response.json(await enrichWithImages(investigation), { status: 200, headers: CORS_HEADERS });
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
