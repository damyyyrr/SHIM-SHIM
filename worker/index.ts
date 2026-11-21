import { createProvider, ProviderConfig } from "../server/provider";
import { runAgent } from "../server/agent";
import { assistantRequestSchema } from "../server/request";
import { parseState } from "../src/data/schema";
// Generated only for deployment; no environment values or user data are embedded.
// @ts-ignore generated after expo export
import { assets } from "./assets.generated";

const active = new Set<string>();
const recent = new Map<string, { expires: number; value: unknown }>();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
export default {
  async fetch(request: Request, env: ProviderConfig): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const identity = request.headers.get("oai-authenticated-user-id");
      if (!identity)
        return json({ error: "Iniciá sesión para usar tu asistente." }, 401);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return json({ error: "Origen no permitido." }, 403);
      const provider = createProvider({ ...env, AI_PROVIDER: "groq" });
      if (url.pathname === "/api/health" && request.method === "GET")
        return json(await provider.health());
      if (url.pathname !== "/api/assistant" || request.method !== "POST")
        return json({ error: "Ruta no disponible." }, 404);
      if (!request.headers.get("content-type")?.includes("application/json"))
        return json({ error: "Se requiere JSON." }, 415);
      if (active.has(identity))
        return json(
          { error: "Ya hay una consulta en curso. Esperá a que termine." },
          429,
        );
      let acquired = false;
      try {
        const raw = await request.text();
        if (raw.length > 2_000_000)
          return json({ error: "La consulta es demasiado grande." }, 413);
        const input = assistantRequestSchema.parse(JSON.parse(raw));
        const state = parseState(JSON.stringify(input.state));
        const key = `${identity}:${state.activeProfileId}:${input.requestId}`;
        for (const [id, item] of recent)
          if (item.expires < Date.now()) recent.delete(id);
        if (recent.has(key)) return json(recent.get(key)!.value);
        active.add(identity);
        acquired = true;
        const result = await runAgent(
          { ...input, state },
          provider.chat,
          provider.model,
          request.signal,
        );
        recent.set(key, { expires: Date.now() + 300000, value: result });
        if (recent.size > 15) recent.delete(recent.keys().next().value!);
        return json(result);
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error && !("issues" in error)
                ? error.message
                : "Los datos enviados no son válidos. No apliqué cambios.",
          },
          503,
        );
      } finally {
        if (acquired) active.delete(identity);
      }
    }
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405 });
    const name = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = (assets as Record<string, { type: string; base64: string }>)[
      name
    ];
    if (!asset) return new Response("No encontrado", { status: 404 });
    const binary = atob(asset.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: {
        "Content-Type": asset.type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control":
          name === "/index.html" ? "no-cache" : "private, max-age=3600",
      },
    });
  },
};
