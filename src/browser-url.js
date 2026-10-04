const SEARCH_ENGINES = {
  duckduckgo: "https://duckduckgo.com/?q=",
  brave: "https://search.brave.com/search?q=",
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
  return SEARCH_ENGINES[Object.hasOwn(SEARCH_ENGINES, engine) ? engine : "duckduckgo"] + encodeURIComponent(value);
}

module.exports = { allowedPage, resolveInput };
