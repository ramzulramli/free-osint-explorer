export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Free OSINT Explorer is alive.");
    }

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");

      if (!query) {
        return Response.json(
          {
            error: "Missing search query",
            usage: "/search?q=keyword"
          },
          { status: 400 }
        );
      }

      return Response.json({
        query: query,
        status: "received",
        message: "Search engine coming next."
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
