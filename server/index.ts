import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { parseState } from "../src/data/schema";
import { runAgent, ModelMessage, TOOL_CATALOG } from "./agent";
import { createProvider } from "./provider";

const root = process.cwd();
if (existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const host = process.env.AI_HOST ?? "127.0.0.1";
const port = Number(process.env.AI_PORT ?? 8787);
const provider = createProvider({
  AI_PROVIDER: process.env.AI_PROVIDER,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  OLLAMA_URL: process.env.OLLAMA_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_CONTEXT: process.env.OLLAMA_CONTEXT,
});
const model = provider.model;
const staticRoot = path.resolve(
  root,
  process.env.STATIC_DIRECTORY ?? "build-check",
);
const requestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    state: z.unknown(),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().min(1).max(10000),
        }),
      )
      .min(1)
      .max(30),
    availableProfiles: z
      .array(z.object({ id: z.string(), name: z.string().max(60) }))
      .max(20)
      .optional(),
    recentActions: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .max(8)
      .optional(),
  })
  .strict();
const inflight = new Set<string>();
const responseCache = new Map<string, { expires: number; value: unknown }>();
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
function allowedOrigin(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (!origin) return true; // Native clients have no browser Origin header.
  try {
    const hostname = new URL(origin).hostname;
    const requestHost = new URL(`http://${req.headers.host}`).hostname;
    if (!["localhost", "127.0.0.1", "[::1]", requestHost].includes(hostname))
      return false;
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    return true;
  } catch {
    return false;
  }
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2_000_000)
      throw new Error("La conversación o sus datos son demasiado grandes.");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function health(res: ServerResponse) {
  json(res, 200, await provider.health());
}
const server = createServer(async (req, res) => {
  if (!allowedOrigin(req, res)) {
    json(res, 403, { error: "Origen no permitido." });
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === "/api/health" && req.method === "GET") {
    await health(res);
    return;
  }
  if (pathname === "/api/assistant" && req.method === "POST") {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    let cacheKey = "",
      acquired = false;
    try {
      if (!req.headers["content-type"]?.includes("application/json")) {
        json(res, 415, { error: "Se requiere JSON." });
        return;
      }
      const parsed = requestSchema.parse(await body(req));
      const state = parseState(JSON.stringify(parsed.state));
      cacheKey = `${state.activeProfileId}:${parsed.requestId}`;
      for (const [key, cached] of responseCache)
        if (cached.expires < Date.now()) responseCache.delete(key);
      const cached = responseCache.get(cacheKey);
      if (cached) {
        json(res, 200, cached.value);
        return;
      }
      // On this 8 GB local setup, serialize generation instead of overloading the model.
      if (inflight.size) {
        json(res, 429, {
          error:
            "Mimo está respondiendo otra consulta. Esperá un momento y probá de nuevo.",
        });
        return;
      }
      inflight.add(cacheKey);
      acquired = true;
      const result = await runAgent(
        { ...parsed, state },
        provider.chat,
        model,
        controller.signal,
      );
      if (!res.destroyed) {
        responseCache.set(cacheKey, {
          expires: Date.now() + 10 * 60000,
          value: result,
        });
        if (responseCache.size > 30)
          responseCache.delete(responseCache.keys().next().value!);
        json(res, 200, result);
      }
    } catch (error) {
      if (!res.destroyed)
        json(
          res,
          error instanceof z.ZodError || error instanceof SyntaxError
            ? 400
            : 503,
          {
            error:
              error instanceof z.ZodError
                ? "Los datos enviados no son válidos."
                : error instanceof Error
                  ? error.message
                  : "No se pudo completar la consulta.",
          },
        );
    } finally {
      if (acquired) inflight.delete(cacheKey);
    }
    return;
  }
  if (pathname.startsWith("/api/")) {
    json(res, 404, { error: "Ruta no disponible." });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const relative =
      decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
    const absolute = path.resolve(staticRoot, relative);
    if (!absolute.startsWith(staticRoot + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!(await stat(absolute)).isFile()) throw new Error();
    const mime: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".ttf": "font/ttf",
      ".png": "image/png",
      ".ico": "image/x-icon",
    };
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(absolute)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(absolute));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Primero exportá la app: npm run export:preview");
  }
});
server.listen(port, host, () =>
  console.log(
    `SHIM-SHIM · Mimo/${provider.provider}: http://${host}:${port} · modelo ${model}`,
  ),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
