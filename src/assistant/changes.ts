import { AppState, id } from "../domain/types";
import { parseState } from "../data/schema";
import { ChangeSet, EntityPatch } from "./types";

export function entityValue(
  state: AppState,
  patch: Pick<EntityPatch, "collection" | "id">,
): unknown {
  if (patch.collection === "activeSessions")
    return state.activeSessions[patch.id] ?? null;
  return state[patch.collection].find((item) => item.id === patch.id) ?? null;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function applyChangeSet(state: AppState, change: ChangeSet): AppState {
  if (state.activeProfileId !== change.profileId)
    throw new Error(
      "Cambiaste de perfil. Volvé a pedir este cambio desde el perfil correcto.",
    );
  let next = state;
  for (const patch of change.patches) {
    if (
      !["profiles", "routines", "sessions", "meals", "activeSessions"].includes(
        patch.collection,
      )
    )
      throw new Error("El cambio no está permitido.");
    const existing = entityValue(next, patch);
    if (!same(existing, patch.before))
      throw new Error(
        "Los datos cambiaron desde la propuesta. Pedile a Mimo que la actualice.",
      );
    if (patch.collection === "activeSessions") {
      if (patch.id !== change.profileId)
        throw new Error("No se puede modificar la sesión de otro perfil.");
    } else if (patch.collection === "profiles") {
      if (patch.id !== change.profileId && patch.before !== null)
        throw new Error(
          "No se puede editar otro perfil desde esta conversación.",
        );
    }
    for (const value of [patch.before, patch.after]) {
      if (value === null) continue;
      if (!value || typeof value !== "object")
        throw new Error("El cambio no contiene datos válidos.");
      const record = value as Record<string, unknown>;
      if (
        patch.collection !== "profiles" &&
        record.profileId !== change.profileId
      )
        throw new Error("El cambio pertenece a otro perfil.");
      if (patch.collection !== "activeSessions" && record.id !== patch.id)
        throw new Error("La identidad del registro no coincide.");
    }
    if (patch.collection === "activeSessions") {
      const activeSessions = { ...next.activeSessions };
      if (patch.after === null) delete activeSessions[patch.id];
      else
        activeSessions[patch.id] =
          patch.after as AppState["activeSessions"][string];
      next = { ...next, activeSessions };
    } else {
      const records =
        patch.after === null
          ? next[patch.collection].filter((item) => item.id !== patch.id)
          : patch.before === null
            ? [...next[patch.collection], patch.after]
            : next[patch.collection].map((item) =>
                item.id === patch.id ? patch.after : item,
              );
      next = { ...next, [patch.collection]: records };
    }
  }
  return parseState(JSON.stringify(next));
}
export function reverseChangeSet(change: ChangeSet): ChangeSet {
  return {
    ...change,
    id: id(),
    label: `Deshacer: ${change.label}`,
    patches: [...change.patches]
      .reverse()
      .map((p) => ({ ...p, before: p.after, after: p.before })),
  };
}
export function applyChanges(state: AppState, changes: ChangeSet[]) {
  return changes.reduce(applyChangeSet, state);
}
