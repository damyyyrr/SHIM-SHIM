const { getDefaultConfig } = require("expo/metro-config");
const http = require("node:http");
const config = getDefaultConfig(__dirname);
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  if (!req.url?.startsWith("/api/")) return middleware(req, res, next);
  const request = http.request(
    {
      hostname: "127.0.0.1",
      port: Number(process.env.AI_PORT || 8787),
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  request.on("error", () => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Encendé el servidor de Mimo con npm run ai." }),
    );
  });
  req.pipe(request);
};
module.exports = config;
