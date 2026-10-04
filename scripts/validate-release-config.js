const config = require("../src/config.json");
if (config.developmentBuild) throw new Error("Local preview configuration cannot be published.");
if (config.apiBase) {
  const url = new URL(config.apiBase);
  if (url.protocol !== "https:" && !/^(localhost|127\.)$/.test(url.hostname))
    throw new Error("Account service must use HTTPS or a local development address.");
}
