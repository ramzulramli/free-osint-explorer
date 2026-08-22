const SEARCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = parseInt(code, 16);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : _;
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeEntity(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanTextForEntities(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const seenUrls = new Set();
  const blocks = html.split(/class=["']result(?:\s+results_links)?["']/i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (/result--ad|ad_provider|ad_domain/i.test(block)) continue;

    const linkMatch = block.match(/class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    let rawUrl = linkMatch[1];
    if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

    let finalUrl = "";
    try {
      const parsed = new URL(rawUrl);
      const destination = parsed.searchParams.get("uddg");
      finalUrl = destination ? decodeURIComponent(destination) : parsed.toString();
    } catch { continue; }

    if (!/^https?:\/\//i.test(finalUrl) || seenUrls.has(finalUrl)) continue;
    seenUrls.add(finalUrl);

    const title = stripHtml(linkMatch[2]);
    const snippetMatch = block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
    if (title || snippet) results.push({ title, url: finalUrl, snippet });
  }

  return results;
}

function looksLikeChallenge(html) {
  const text = String(html || "").toLowerCase();
  return /captcha|robot|unusual traffic|automated|bot detection|challenge/.test(text);
}

async function fetchDuckPage(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": SEARCH_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://html.duckduckgo.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin"
    },
    body: new URLSearchParams(body).toString()
  });
  const html = await response.text();
  return { response, html };
}

const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    if (!query || query.length > 499) throw new Error("Search query must be between 1 and 499 characters");

    const attempts = [
      { url: "https://html.duckduckgo.com/html/", body: { q: query, b: "" } },
      { url: "https://lite.duckduckgo.com/lite/", body: { q: query } }
    ];

    let lastStatus = null;
    let challengeDetected = false;

    for (const attempt of attempts) {
      const { response, html } = await fetchDuckPage(attempt.url, attempt.body);
      lastStatus = response.status;
      if (!response.ok) continue;
      if (looksLikeChallenge(html)) { challengeDetected = true; continue; }

      const results = parseDuckDuckGoResults(html);
      if (results.length) return { provider: "duckduckgo", query, results };

      const hasSearchStructure = /result__a|result__snippet|result[_\-]links|no-results/i.test(html);
      if (hasSearchStructure) return { provider: "duckduckgo", query, results: [] };
    }

    if (challengeDetected) throw new Error("DuckDuckGo returned a bot/challenge response; search was not parsed");
    if (lastStatus && lastStatus !== 200) throw new Error(`Search provider returned ${lastStatus}`);
    throw new Error("DuckDuckGo response could not be parsed as a search-results page");
  }
};

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : "";
}

function extractLinks(html, baseUrl) {
  const links = [], seen = new Set();
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || seen.has(url.toString())) continue;
      seen.add(url.toString());
      links.push({ text: stripHtml(match[2]), url: url.toString() });
    } catch {}
  }
  return links;
}

function extractReadableText(html) {
  const cleaned = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return stripHtml(cleaned);
}

const COMMON_NON_PERSON_WORDS = new Set(["wikipedia","jump","navigation","main","contents","current","about","contact","contribute","help","learn","search","appearance","donate","create","account","article","talk","english","read","edit","view","history","tools","actions","general","what","from","personal","information","date","birth","place","height","position","youth","career","team","league","club","cup","season","apps","goals","total","international","statistics","reference","references","external","links","privacy","policy","creative","commons","attribution","conduct","developers","cookie","toggle","hidden","categories","malaysian","men","forward","striker","senior","junior","years","head","this","use","official","wiki","database","monster","squad","players","former","born","full","name","safety","how"]);
const COMMON_NON_PERSON_PHRASES = new Set(["penternak arnab"]);
const COMMON_ORGANISATION_WORDS = new Set(["berhad","bhd","sdn","sendirian","foundation","association","university","corporation","company","limited","ltd","fc","f.c.","fa","f.a.","team","club"]);
const MALAYSIAN_LOCATIONS = ["Malaysia","Selangor","Kuala Lumpur","Terengganu","Kelantan","Johor","Penang","Perak","Pahang","Negeri Sembilan","Melaka","Sabah","Sarawak","Putrajaya","Labuan","Shah Alam","Petaling Jaya","Klang","Tumpat","Wakaf Bharu","Kota Bharu","Kuala Terengganu"];

function isLikelyPersonName(value) {
  const words = value.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5 || value.length < 5 || value.length > 80) return false;
  const normalized = normalizeEntity(value);
  if (COMMON_NON_PERSON_PHRASES.has(normalized) || MALAYSIAN_LOCATIONS.some(x => normalizeEntity(x) === normalized)) return false;
  const lowerWords = words.map(w => w.replace(/[^a-zA-ZÀ-ÿ'-]/g, "").toLowerCase());
  if (lowerWords.some(w => COMMON_NON_PERSON_WORDS.has(w) || COMMON_ORGANISATION_WORDS.has(w))) return false;
  return words.filter(w => /^[A-ZÀ-Ý][a-zà-ÿ'-]*$/.test(w)).length >= 2;
}

function extractPersonCandidates(text) {
  const out = [], seen = new Set();
  const regex = /\b[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+(?:bin|binti|[A-ZÀ-Ý][a-zà-ÿ'-]+)){1,4}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0].trim();
    if (!isLikelyPersonName(value)) continue;
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ type: "person_candidate", value, normalized, confidence: /\b(bin|binti)\b/i.test(value) ? 0.85 : 0.60, evidence: "Name-like phrase found in page text" });
  }
  return out;
}

function extractOrganisationCandidates(text) {
  const out = [], seen = new Set();
  const regex = /\b[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*){0,2}\s+(?:Berhad|Bhd|Sdn Bhd|Foundation|Association|University|Corporation|Company|Limited|Ltd|FA|F\.A\.|FC|F\.C\.)\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0].replace(/\s+/g, " ").trim(), normalized = normalizeEntity(value);
    if (value.length < 4 || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ type: "organisation_candidate", value, normalized, confidence: 0.70, evidence: "Organisation-like phrase found in page text" });
  }
  return out;
}

function extractLocationCandidates(text) {
  const out = [], seen = new Set();
  for (const location of MALAYSIAN_LOCATIONS) {
    const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`\\b${escaped}\\b`, "i").test(text)) continue;
    const normalized = normalizeEntity(location);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ type: "location_candidate", value: location, normalized, confidence: 0.85, evidence: "Known Malaysian location found in page text" });
  }
  return out;
}

function extractEmails(text) {
  return uniqueRegex(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, (value) => ({ type: "email", value, normalized: normalizeEntity(value), confidence: 0.99, evidence: "Email address pattern found in page text" }));
}
function extractPhoneNumbers(text) {
  const out = [], seen = new Set();
  const regex = /(?:\+?60[\s.-]?1[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}|01[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4})/g;
  let match;
  while ((match = regex.exec(text)) !== null) { const value = match[0].trim(), normalized = value.replace(/\D/g, ""); if (normalized.length < 10 || normalized.length > 12 || seen.has(normalized)) continue; seen.add(normalized); out.push({ type: "phone", value, normalized, confidence: 0.90, evidence: "Malaysian phone number pattern found in page text" }); }
  return out;
}
function extractUrls(text) { return uniqueRegex(text, /\bhttps?:\/\/[^\s<>"']+/gi, value => { value = value.replace(/[),.;]+$/, ""); return { type: "url", value, normalized: normalizeEntity(value), confidence: 0.99, evidence: "URL found in page text" }; }); }
function extractUsernames(text) { return uniqueRegex(text, /(^|[^\w])@([A-Za-z0-9._-]{2,30})\b/g, value => { const username = value.replace(/^.*@/, "@"); return { type: "username", value: username, normalized: normalizeEntity(username), confidence: 0.95, evidence: "Explicit @username found in page text" }; }); }
function extractDates(text) { return uniqueRegex(text, /\b(?:0?[1-9]|[12][0-9]|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/g, value => ({ type: "date", value, normalized: normalizeEntity(value), confidence: 0.90, evidence: "Date pattern found in page text" })); }
function extractYears(text) { return uniqueRegex(text, /\b(?:19|20)\d{2}\b/g, value => ({ type: "year", value, normalized: normalizeEntity(value), confidence: 0.85, evidence: "Four-digit year found in page text" })); }
function uniqueRegex(text, regex, mapper) { const out = [], seen = new Set(); let match; while ((match = regex.exec(text)) !== null) { const entity = mapper(match[0]); if (!entity || seen.has(entity.normalized)) continue; seen.add(entity.normalized); out.push(entity); } return out; }

function extractKeywords(text) {
  const stopWords = new Set(["the","and","for","with","from","this","that","have","has","are","was","were","you","your","our","their","about","into","more","www","http","https"]);
  const counts = new Map();
  for (const word of text.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g) || []) { if (!stopWords.has(word)) counts.set(word, (counts.get(word) || 0) + 1); }
  return [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,20).map(([value,count]) => ({ type:"keyword", value, normalized:value, confidence:Math.min(0.95,0.45 + count*0.05), evidence:"Repeated content keyword" }));
}

function deduplicateEntities(entities) {
  const map = new Map();
  for (const entity of entities) { const key = `${entity.type}:${entity.normalized}`; const existing = map.get(key); if (!existing || entity.confidence > existing.confidence) map.set(key, entity); }
  return [...map.values()];
}

function extractEntityCandidates(text) {
  const cleaned = cleanTextForEntities(text);
  return deduplicateEntities([
    ...extractPersonCandidates(cleaned), ...extractOrganisationCandidates(cleaned), ...extractLocationCandidates(cleaned),
    ...extractEmails(cleaned), ...extractPhoneNumbers(cleaned), ...extractUrls(cleaned), ...extractUsernames(cleaned),
    ...extractDates(cleaned), ...extractYears(cleaned), ...extractKeywords(cleaned)
  ]);
}

export { SEARCH_PROVIDERS, extractEntityCandidates, extractTitle, extractReadableText, extractLinks };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.json({ name: "Free OSINT Explorer", status: "online", version: "0.3.1" });
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) return Response.json({ error: "Missing search query", usage: "/search?q=keyword" }, { status: 400 });
      try { return Response.json({ status: "success", ...(await SEARCH_PROVIDERS.duckduckgo(query)) }); }
      catch (error) { return Response.json({ status: "error", message: error.message }, { status: 502 }); }
    }
    if (url.pathname === "/fetch" || url.pathname === "/read" || url.pathname === "/entities") {
      const target = url.searchParams.get("url")?.trim();
      if (!target) return Response.json({ error: "Missing URL", usage: `${url.pathname}?url=https://example.com` }, { status: 400 });
      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
        const response = await fetch(targetUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
        const html = await response.text();
        if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
        if (url.pathname === "/fetch") return Response.json({ status:"success", url:targetUrl.toString(), httpStatus:response.status, contentType:response.headers.get("content-type"), contentLength:html.length, preview:html.substring(0,1000) });
        const title = extractTitle(html), text = extractReadableText(html);
        if (url.pathname === "/read") { const links = extractLinks(html,targetUrl.toString()); return Response.json({ status:"success", url:targetUrl.toString(), httpStatus:response.status, title, textLength:text.length, text:text.substring(0,10000), linkCount:links.length, links:links.slice(0,100) }); }
        const entities = extractEntityCandidates(text); return Response.json({ status:"success", url:targetUrl.toString(), httpStatus:response.status, title, textLength:text.length, entityCount:entities.length, entities });
      } catch (error) { return Response.json({ status:"error", message:error.message }, { status:502 }); }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
};