const { sites } = require("../backend/resources/catalog.json");
const fetch = require("cross-fetch");
(async () => {
  for (let i = 0; i < sites.length; i += 3) {
    const results = await Promise.allSettled(
      sites.slice(i, i + 3).map(async (site) => {
        const res = await fetch(site.url, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        return {
          name: site.name,
          url: site.url,
          http: res.status,
          redirect: res.headers.get("location"),
          note: "HTTP check only; playback and free access are not verified.",
        };
      }),
    );
    for (const [index, result] of results.entries())
      console.log(
        JSON.stringify(
          result.status === "fulfilled"
            ? result.value
            : { name: sites[i + index].name, error: result.reason.message },
        ),
      );
  }
})();
