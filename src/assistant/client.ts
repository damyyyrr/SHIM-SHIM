import { Platform } from "react-native";
import { AppState, ChatMessage, id, localDateKey } from "../domain/types";
import { assistantResponseSchema } from "./schema";
import { ConnectionStatus } from "./types";
import { scopeState } from "./context";

export function apiBase(state: Pick<AppState, "assistantServerUrl">) {
  return (
    state.assistantServerUrl ||
    (Platform.OS === "web"
      ? ""
      : process.env.EXPO_PUBLIC_AI_SERVER_URL || "http://127.0.0.1:8787")
  ).replace(/\/$/, "");
}
export async function connectionStatus(
  state: AppState,
): Promise<ConnectionStatus> {
  try {
    const response = await fetch(`${apiBase(state)}/api/health`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (typeof data.connected !== "boolean" || !Array.isArray(data.models))
      throw new Error();
    return data;
  } catch {
    return {
      connected: false,
      model: "Mimo",
      models: [],
      message:
        "No pude conectar con el servidor de Mimo. Revisá tu conexión a internet e intentá de nuevo.",
    };
  }
}
export async function askAssistant(
  state: AppState,
  history: ChatMessage[],
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(`${apiBase(state)}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
      body: JSON.stringify({
        requestId: id(),
        state: scopeState(state),
        today: localDateKey(),
        availableProfiles: state.profiles.map((p) => ({
          id: p.id,
          name: p.name,
        })),
        recentActions: state.messages
          .filter((m) => m.profileId === state.activeProfileId)
          .flatMap((m) => m.actions ?? [])
          .filter(
            (a) =>
              a.status === "applied" && a.change && a.tool !== "create_profile",
          )
          .slice(-8)
          .map((a) => ({ id: a.id, label: a.label })),
        messages: history
          .filter((m) => m.profileId === state.activeProfileId)
          .slice(-20)
          .map((m) => ({
            role: m.role,
            text:
              m.text +
              (m.actions?.length
                ? `\n[Actividad actual: ${m.actions.map((a) => `${a.label}: ${a.status}`).join("; ")}]`
                : ""),
          })),
      }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "No pude terminar la consulta con Mimo. Revisá la conexión e intentá de nuevo. No apliqué cambios.",
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  if (!response.ok)
    throw new Error(data.error || "No se pudo completar la consulta.");
  const parsed = assistantResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("La respuesta no pasó la validación. No apliqué cambios.");
  return parsed.data;
}
