import { ModelMessage, ChatModel, TOOL_CATALOG } from "./agent";

export type ProviderConfig = {
  AI_PROVIDER?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OLLAMA_URL?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_CONTEXT?: string;
};
export function createProvider(
  config: ProviderConfig,
  transport: typeof fetch = fetch,
) {
  const provider = config.AI_PROVIDER === "ollama" ? "ollama" : "groq";
  const model =
    provider === "groq"
      ? config.GROQ_MODEL || "openai/gpt-oss-120b"
      : config.OLLAMA_MODEL || "qwen3:4b";
  const base =
    provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : (config.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const headers = () => ({
    "Content-Type": "application/json",
    ...(provider === "groq"
      ? { Authorization: `Bearer ${config.GROQ_API_KEY}` }
      : {}),
  });
  async function health() {
    if (provider === "groq" && !config.GROQ_API_KEY)
      return {
        connected: false,
        provider,
        model,
        models: [],
        message:
          "Falta configurar la clave de Groq en el servidor. No se carga en el celular.",
      };
    try {
      const response = await transport(
        `${base}/${provider === "groq" ? "models" : "api/tags"}`,
        { headers: headers(), signal: AbortSignal.timeout(6000) },
      );
      if (!response.ok) throw new Error();
      const data = (await response.json()) as any;
      const models: string[] =
        provider === "groq"
          ? (data.data ?? []).map((m: any) => m.id)
          : (data.models ?? []).map((m: any) => m.name);
      return {
        connected: models.includes(model),
        provider,
        model,
        models,
        message: models.includes(model)
          ? provider === "groq"
            ? "Conectado a Groq. No depende de tu computadora."
            : "Conectado al modelo local."
          : "El modelo configurado no está disponible en este proveedor.",
      };
    } catch {
      return {
        connected: false,
        provider,
        model,
        models: [],
        message:
          provider === "groq"
            ? "No pude verificar Groq. Revisá la clave y la conexión del servidor."
            : "No pude conectar con Ollama. Abrilo en la computadora.",
      };
    }
  }
  let sequence = 0;
  const chat: ChatModel = async (messages, signal, requestOptions) => {
    if (provider === "groq" && !config.GROQ_API_KEY)
      throw new Error(
        "Falta configurar GROQ_API_KEY en el servidor para activar Mimo.",
      );
    const converted = messages.map((message) =>
      message.role === "tool"
        ? {
            role: "tool",
            content: message.content,
            tool_call_id: message.tool_call_id,
          }
        : {
            role: message.role,
            content: message.content || null,
            ...(message.tool_calls?.length
              ? {
                  tool_calls: message.tool_calls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: {
                      name: call.function.name,
                      arguments: JSON.stringify(call.function.arguments),
                    },
                  })),
                }
              : {}),
          },
    );
    const tools =
      requestOptions?.allowTools === false ? undefined : TOOL_CATALOG;
    const body =
      provider === "groq"
        ? {
            model,
            messages: converted,
            ...(tools
              ? { tools, tool_choice: "auto", parallel_tool_calls: false }
              : {}),
            temperature: 0.2,
            max_completion_tokens: 1800,
            reasoning_effort: "low",
          }
        : {
            model,
            messages,
            tools,
            stream: false,
            think: false,
            keep_alive: "5m",
            options: {
              temperature: 0.2,
              num_ctx: Number(config.OLLAMA_CONTEXT || 12288),
              num_predict: 1500,
              num_batch: 128,
            },
          };
    let response: Response;
    try {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(180000)])
        : AbortSignal.timeout(180000);
      for (let attempt = 0; ; attempt++) {
        response = await transport(
          `${base}/${provider === "groq" ? "chat/completions" : "api/chat"}`,
          {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(body),
            signal: requestSignal,
          },
        );
        if (response.status !== 429 || attempt >= 2) break;
        const error = (await response
          .clone()
          .json()
          .catch(() => ({}))) as any;
        if (/request too large/i.test(error.error?.message ?? ""))
          throw new Error(
            "El contexto de esta consulta supera el límite del plan gratuito. Pedime revisar un ejercicio o una parte del plan por vez.",
          );
        const seconds = Math.min(
          60,
          Math.max(2, Number(response.headers.get("retry-after")) || 20),
        );
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            requestSignal.removeEventListener("abort", cancel);
            resolve();
          };
          const timer = setTimeout(done, seconds * 1000);
          const cancel = () => {
            clearTimeout(timer);
            reject(new Error("Consulta detenida."));
          };
          requestSignal.addEventListener("abort", cancel, { once: true });
        });
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(
        `No pude obtener una respuesta de ${provider === "groq" ? "Groq" : "Ollama"}. No apliqué cambios.`,
      );
    }
    if (response.status === 429)
      throw new Error(
        "Llegamos al límite temporal de la cuota gratuita de IA. Esperá un minuto y probá de nuevo. No apliqué cambios ni cambié a un plan pago.",
      );
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "La clave del proveedor no es válida. Revisá la configuración del servidor."
          : `El proveedor no pudo completar la consulta (${response.status}). No apliqué cambios.`,
      );
    const data = (await response.json()) as any;
    const raw = provider === "groq" ? data.choices?.[0]?.message : data.message;
    if (!raw) throw new Error("El proveedor no devolvió una respuesta válida.");
    const result: ModelMessage = {
      role: "assistant",
      content: raw.content ?? "",
    };
    if (raw.tool_calls?.length)
      result.tool_calls = raw.tool_calls.map((call: any) => ({
        id: call.id || `call_${++sequence}`,
        function: {
          name: call.function.name,
          arguments:
            typeof call.function.arguments === "string"
              ? JSON.parse(call.function.arguments)
              : call.function.arguments,
        },
      }));
    return result;
  };
  return { provider, model, health, chat };
}
