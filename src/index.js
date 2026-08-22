const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
      }
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    const seenUrls = new Set();
    const resultBlocks = html.split('class="result results_links');

    for (let i = 1; i < resultBlocks.length; i++) {
      const block = resultBlocks[i];

      if (block.includes("result--ad") || block.includes("ad_provider") || block.includes("ad_domain")) continue;

      const linkMatch = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );
      if (!linkMatch) continue;

      let rawUrl = linkMatch[1];
      if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

      let finalUrl;
      try {
        const parsed = new URL(rawUrl);
        const destination = parsed.searchParams.get("uddg");
        finalUrl = destination ? decodeURIComponent(destination) : parsed.toString();
      } catch {
        continue;
      }

      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) continue;
      if (seenUrls.has(finalUrl)) continue;
      seenUrls.add(finalUrl);

      const title = decodeHtmlEntities(linkMatch[2].replace(/<[^>]*>/g, "").trim());
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/);
      const snippet = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, "").trim())
        : "";

      results.push({ title, url: finalUrl, snippet });
    }

    return { provider: "duckduckgo", query, results };
  }
};

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeEntity(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanTextForEntities(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractLinks(html, baseUrl) {
  const links = [];
  const seenUrls = new Set();
  const linkRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href) continue;
    try {
      const absoluteUrl = new URL(href, baseUrl);
      if (!["http:", "https:"].includes(absoluteUrl.protocol)) continue;
      const finalUrl = absoluteUrl.toString();
      if (seenUrls.has(finalUrl)) continue;
      seenUrls.add(finalUrl);
      const linkText = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      links.push({ text: linkText, url: finalUrl });
    } catch {}
  }
  return links;
}

function extractReadableText(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return decodeHtmlEntities(cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

const COMMON_NON_PERSON_WORDS = new Set([
  "wikipedia", "jump", "navigation", "main", "contents", "current", "about", "contact", "contribute", "help", "learn", "search", "appearance", "donate", "create", "account", "article", "talk", "english", "read", "edit", "view", "history", "tools", "actions", "general", "what", "from", "personal", "information", "date", "birth", "place", "height", "position", "youth", "career", "team", "league", "club", "cup", "season", "apps", "goals", "total", "international", "statistics", "reference", "references", "external", "links", "privacy", "policy", "creative", "commons", "attribution", "conduct", "developers", "cookie", "toggle", "hidden", "categories", "malaysian", "men", "forward", "striker", "senior", "junior", "years", "head", "this", "use", "official", "wiki", "database", "monster", "squad", "players", "former", "born", "full", "name"
]);
const COMMON_NON_PERSON_PHRASES = new Set(["penternak arnab"]);
const COMMON_ORGANISATION_WORDS = new Set(["berhad", "bhd", "sdn", "sendirian", "foundation", "association", "university", "corporation", "company", "limited", "ltd", "fc", "f.c.", "fa", "f.a.", "team", "club"]);
const MALAYSIAN_LOCATIONS = ["Malaysia", "Selangor", "Kuala Lumpur", "Terengganu", "Kelantan", "Johor", "Penang", "Perak", "Pahang", "Negeri Sembilan", "Melaka", "Sabah", "Sarawak", "Putrajaya", "Labuan", "Shah Alam", "Petaling Jaya", "Klang", "Tumpat", "Wakaf Bharu", "Kota Bharu", "Kuala Terengganu"];

function isLikelyPersonName(value) {
  const cleaned = value.trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 5 || cleaned.length < 5 || cleaned.length > 80) return false;
  const normalizedValue = normalizeEntity(cleaned);
  if (COMMON_NON_PERSON_PHRASES.has(normalizedValue)) return false;
  if (MALAYSIAN_LOCATIONS.some(location => normalizeEntity(location) === normalizedValue)) return false;
  const lowerWords = words.map(word => word.replace(/[^a-zA-ZÀ-ÿ'-]/g, "").toLowerCase());
  if (lowerWords.some(word => COMMON_NON_PERSON_WORDS.has(word))) return false;
  if (lowerWords.some(word => COMMON_ORGANISATION_WORDS.has(word))) return false;
  const properNameWords = words.filter(word => /^[A-ZÀ-Ý][a-zà-ÿ'-]*$/.test(word)).length;
  return properNameWords >= 2;
}

function extractPersonCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const nameRegex = /\b[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+(?:bin|binti|[A-ZÀ-Ý][a-zà-ÿ'-]+)){1,4}\b/g;
  let match;
  while ((match = nameRegex.exec(text)) !== null) {
    const value = match[0].trim();
    if (!isLikelyPersonName(value)) continue;
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "person_candidate", value, normalized, confidence: /\b(bin|binti)\b/i.test(value) ? 0.85 : 0.60, evidence: "Name-like phrase found in page text" });
  }
  return candidates;
}

function extractOrganisationCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const organisationRegex = /\b[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*){0,2}\s+(?:Berhad|Bhd|Sdn Bhd|Foundation|Association|University|Corporation|Company|Limited|Ltd|FA|F\.A\.|FC|F\.C\.)\b/g;
  let match;
  while ((match = organisationRegex.exec(text)) !== null) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length < 4) continue;
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "organisation_candidate", value, normalized, confidence: 0.70, evidence: "Organisation-like phrase found in page text" });
  }
  return candidates;
}

function extractLocationCandidates(text) {
  const candidates = [];
  const seen = new Set();
  for (const location of MALAYSIAN_LOCATIONS) {
    const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`\\b${escaped}\\b`, "i").test(text)) continue;
    const normalized = normalizeEntity(location);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "location_candidate", value: location, normalized, confidence: 0.85, evidence: "Known Malaysian location found in page text" });
  }
  return candidates;
}

function extractEmails(text) {
  const candidates = [], seen = new Set();
  const regex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0], normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "email", value, normalized, confidence: 0.99, evidence: "Email address pattern found in page text" });
  }
  return candidates;
}

function extractPhoneNumbers(text) {
  const candidates = [], seen = new Set();
  const regex = /(?:\+?60[\s.-]?1[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}|01[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0].trim(), digits = value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 12) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    candidates.push({ type: "phone", value, normalized: digits, confidence: 0.90, evidence: "Malaysian phone number pattern found in page text" });
  }
  return candidates;
}

function extractUrls(text) {
  const candidates = [], seen = new Set();
  const regex = /\bhttps?:\/\/[^\s<>"']+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0].replace(/[),.;]+$/, ""), normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "url", value, normalized, confidence: 0.99, evidence: "URL found in page text" });
  }
  return candidates;
}

function extractUsernames(text) {
  const candidates = [], seen = new Set();
  const regex = /(^|[^\w])@([A-Za-z0-9._-]{2,30})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = `@${match[2]}`, normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "username", value, normalized, confidence: 0.95, evidence: "Explicit @username found in page text" });
  }
  return candidates;
}

function extractDates(text) {
  const candidates = [], seen = new Set();
  const regex = /\b(?:0?[1-9]|[12][0-9]|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0], normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "date", value, normalized, confidence: 0.90, evidence: "Date pattern found in page text" });
  }
  return candidates;
}

function extractYears(text) {
  const candidates = [], seen = new Set();
  const regex = /\b(?:19|20)\d{2}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0], normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ type: "year", value, normalized, confidence: 0.85, evidence: "Four-digit year found in page text" });
  }
  return candidates;
}

function extractKeywords(text) {
  const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "have", "has", "are", "was", "were", "you", "your", "our", "their", "about", "into", "more", "www", "http", "https"]);
  const counts = new Map();
  for (const word of text.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g) || []) {
    if (stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([value, count]) => ({ type: "keyword", value, normalized: value, confidence: Math.min(0.95, 0.45 + count * 0.05), evidence: "Repeated content keyword" }));
}

function deduplicateEntities(entities) {
  const map = new Map();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalized}`;
    const existing = map.get(key);
    if (!existing || entity.confidence > existing.confidence) map.set(key, entity);
  }
  return [...map.values()];
}

function extractEntityCandidates(text) {
  const cleaned = cleanTextForEntities(text);
  return deduplicateEntities([
    ...extractPersonCandidates(cleaned),
    ...extractOrganisationCandidates(cleaned),
    ...extractLocationCandidates(cleaned),
    ...extractEmails(cleaned),
    ...extractPhoneNumbers(cleaned),
    ...extractUrls(cleaned),
    ...extractUsernames(cleaned),
    ...extractDates(cleaned),
    ...extractYears(cleaned),
    ...extractKeywords(cleaned)
  ]);
}

export { SEARCH_PROVIDERS, extractEntityCandidates, extractTitle, extractReadableText, extractLinks };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.json({ name: "Free OSINT Explorer", status: "online", version: "0.3.0" });
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) return Response.json({ error: "Missing search query", usage: "/search?q=keyword" }, { status: 400 });
      try { return Response.json({ status: "success", ...(await SEARCH_PROVIDERS.duckduckgo(query)) }); }
      catch (error) { return Response.json({ status: "error", message: error.message }, { status: 502 }); }
    }
    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url")?.trim();
      if (!target) return Response.json({ error: "Missing URL", usage: "/fetch?url=https://example.com" }, { status: 400 });
      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
        const response = await fetch(targetUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
        const html = await response.text();
        return Response.json({ status: "success", url: targetUrl.toString(), httpStatus: response.status, contentType: response.headers.get("content-type"), contentLength: html.length, preview: html.substring(0, 1000) });
      } catch (error) { return Response.json({ status: "error", message: error.message }, { status: 502 }); }
    }
    if (url.pathname === "/read") {
      const target = url.searchParams.get("url")?.trim();
      if (!target) return Response.json({ error: "Missing URL", usage: "/read?url=https://example.com" }, { status: 400 });
      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
        const response = await fetch(targetUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
        if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
        const html = await response.text();
        const title = extractTitle(html), text = extractReadableText(html), links = extractLinks(html, targetUrl.toString());
        return Response.json({ status: "success", url: targetUrl.toString(), httpStatus: response.status, title, textLength: text.length, text: text.substring(0, 10000), linkCount: links.length, links: links.slice(0, 100) });
      } catch (error) { return Response.json({ status: "error", message: error.message }, { status: 502 }); }
    }
    if (url.pathname === "/entities") {
      const target = url.searchParams.get("url")?.trim();
      if (!target) return Response.json({ error: "Missing URL", usage: "/entities?url=https://example.com" }, { status: 400 });
      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
        const response = await fetch(targetUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
        if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
        const html = await response.text();
        const title = extractTitle(html), text = extractReadableText(html), entities = extractEntityCandidates(text);
        return Response.json({ status: "success", url: targetUrl.toString(), httpStatus: response.status, title, textLength: text.length, entityCount: entities.length, entities });
      } catch (error) { return Response.json({ status: "error", message: error.message }, { status: 502 }); }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
};