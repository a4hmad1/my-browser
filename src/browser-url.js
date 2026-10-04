const SEARCH_ENGINES = {
  duckduckgo: "https://duckduckgo.com/?q=",
  brave: "https://search.brave.com/search?q=",
};

const KEYWORD_SEARCHES = {
  g: "https://www.google.com/search?q=",
  google: "https://www.google.com/search?q=",
  d: "https://duckduckgo.com/?q=",
  ddg: "https://duckduckgo.com/?q=",
  b: "https://search.brave.com/search?q=",
  brave: "https://search.brave.com/search?q=",
  yt: "https://www.youtube.com/results?search_query=",
  youtube: "https://www.youtube.com/results?search_query=",
  w: "https://en.wikipedia.org/w/index.php?search=",
  wiki: "https://en.wikipedia.org/w/index.php?search=",
  wikipedia: "https://en.wikipedia.org/w/index.php?search=",
  imdb: "https://www.imdb.com/find/?q=",
  beenar: "https://beenar.net/?s=",
  kurd: "https://kurdsubtitle.net/?s=",
};

function allowedPage(raw) {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function resolveInput(input, engine = "duckduckgo") {
  const value = String(input || "").trim();
  if (!value) throw new Error("Enter a website or search terms.");
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^(?:javascript|file|data|ftp|blob|about|mailto|chrome|devtools):/i.test(value)) {
    if (!allowedPage(value)) throw new Error("Only HTTP and HTTPS websites can be opened.");
    return new URL(value).href;
  }
  const address = /^(localhost|\[[\da-f:]+\]|(?:\d{1,3}\.){3}\d{1,3}|[^\s/]+\.[^\s/]+|[^\s/]+:\d+)(?:[/:?#]|$)/i.test(value);
  if (address && !/\s/.test(value)) {
    const host = value.split(/[/?#]/)[0].toLowerCase();
    const local = host === "localhost" || host.startsWith("localhost:") || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(host) || host.startsWith("[") || /\.(local|internal|test|onion)(?::\d+)?$/.test(host);
    const url = (local ? "http://" : "https://") + value;
    if (allowedPage(url)) return new URL(url).href;
  }
  const kwMatch = value.match(/^([a-z0-9_-]+)\s+(.+)$/i);
  if (kwMatch) {
    const kw = kwMatch[1].toLowerCase();
    if (Object.hasOwn(KEYWORD_SEARCHES, kw)) {
      return KEYWORD_SEARCHES[kw] + encodeURIComponent(kwMatch[2].trim());
    }
  }
  return SEARCH_ENGINES[Object.hasOwn(SEARCH_ENGINES, engine) ? engine : "duckduckgo"] + encodeURIComponent(value);
}

module.exports = { allowedPage, resolveInput, KEYWORD_SEARCHES };
