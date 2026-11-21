import { AppState } from "../domain/types";
export function scopeState(state: AppState): AppState {
  const pid = state.activeProfileId;
  return {
    ...state,
    profiles: state.profiles.filter((p) => p.id === pid),
    routines: state.routines.filter((r) => r.profileId === pid),
    sessions: state.sessions.filter((s) => s.profileId === pid),
    meals: state.meals.filter((m) => m.profileId === pid),
    activeSessions: state.activeSessions[pid]
      ? { [pid]: state.activeSessions[pid] }
      : {},
    messages: [],
  };
}
