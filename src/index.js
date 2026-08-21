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
    const resultBlocks = html.split('class="result results_links');

    for (let i = 1; i < resultBlocks.length; i++) {
      const block = resultBlocks[i];

      const linkMatch = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );

      if (!linkMatch) {
        continue;
      }

      const url = decodeURIComponent(linkMatch[1]);

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
        url,
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
        const provider = SEARCH_PROVIDERS.duckduckgo;
        const result = await provider(query);

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

    return Response.json(
      {
        error: "Not found"
      },
      { status: 404 }
    );
  }
};
