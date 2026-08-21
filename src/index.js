const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    const searchUrl =
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

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

      // Skip advertisements
      if (
        block.includes("result--ad") ||
        block.includes("ad_provider") ||
        block.includes("ad_domain")
      ) {
        continue;
      }

      const linkMatch = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );

      if (!linkMatch) {
        continue;
      }

      let rawUrl = linkMatch[1];

      // Convert relative URL to absolute URL
      if (rawUrl.startsWith("//")) {
        rawUrl = "https:" + rawUrl;
      }

      let finalUrl;

      try {
        const parsed = new URL(rawUrl);

        // DuckDuckGo redirect URL
        const destination = parsed.searchParams.get("uddg");

        if (destination) {
          finalUrl = decodeURIComponent(destination);
        } else {
          finalUrl = parsed.toString();
        }
      } catch {
        continue;
      }

      // Only accept HTTP/HTTPS
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        continue;
      }

      // Remove duplicate URLs
      if (seenUrls.has(finalUrl)) {
        continue;
      }

      seenUrls.add(finalUrl);

      const title = linkMatch[2]
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();

      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/
      );

      const snippet = snippetMatch
        ? snippetMatch[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .trim()
        : "";

      results.push({
        title,
        url: finalUrl,
        snippet
      });
    }

    return {
      provider: "duckduckgo",
      query,
      results
    };
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        name: "Free OSINT Explorer",
        status: "online",
        version: "0.1.0"
      });
    }

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();

      if (!query) {
        return Response.json(
          {
            error: "Missing search query",
            usage: "/search?q=keyword"
          },
          { status: 400 }
        );
      }

      try {
        const result = await SEARCH_PROVIDERS.duckduckgo(query);

        return Response.json({
          status: "success",
          ...result
        });
      } catch (error) {
        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }
    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url")?.trim();

      if (!target) {
        return Response.json(
          {
            error: "Missing URL",
            usage: "/fetch?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {
        const targetUrl = new URL(target);

        if (!["http:", "https:"].includes(targetUrl.protocol)) {
          throw new Error("Only HTTP and HTTPS URLs are allowed");
        }

        const response = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
          }
        });

        const html = await response.text();

        return Response.json({
          status: "success",
          url: targetUrl.toString(),
          httpStatus: response.status,
          contentType: response.headers.get("content-type"),
          contentLength: html.length,
          preview: html.substring(0, 1000)
        });

      } catch (error) {
        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }
    return Response.json(
      {
        error: "Not found"
      },
      { status: 404 }
    );
  }
};
