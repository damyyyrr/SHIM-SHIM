import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  AppState,
  ChatMessage,
  MealEntry,
  Profile,
  Routine,
  Session,
  WorkoutSet,
  id,
} from '../domain/types';
import { createInitialState } from '../domain/seed';
import { completedSets, startSession } from '../domain/training';
import { parseState } from './schema';
import { readState, writeState } from './storage';

type Store = {
  state: AppState;
  profile: Profile;
  activeSession?: Session;
  ready: boolean;
  loadError: string | null;
  saveError: boolean;
  saving: boolean;
  switchProfile: (id: string) => void;
  saveProfile: (profile: Profile) => void;
  saveRoutine: (routine: Routine) => void;
  deleteRoutine: (id: string) => void;
  begin: (routine: Routine) => void;
  updateSet: (exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => void;
  setTechnique: (exerciseIndex: number, value: boolean) => void;
  setRest: (end?: number) => void;
  finish: () => Session | undefined;
  discard: () => void;
  addMeal: (meal: MealEntry) => void;
  removeMeal: (id: string) => void;
  addMessages: (messages: ChatMessage[]) => void;
  importState: (raw: string) => void;
  clearExamples: () => void;
  reload: () => void;
  retrySave: () => void;
};
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  async function reload() {
    setReady(false);
    setLoadError(null);
    try {
      const raw = await readState();
      setState(raw ? parseState(raw) : createInitialState());
      setReady(true);
    } catch {
      setLoadError(
        'No pudimos leer los datos guardados. No los reemplazamos. Podés volver a intentar o restaurar un respaldo.',
      );
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const current = ++revision.current;
    const raw = JSON.stringify(state);
    setSaving(true);
    queue.current = queue.current
      .catch(() => {})
      .then(() => writeState(raw))
      .then(() => {
        if (revision.current === current) {
          setSaveError(false);
          setSaving(false);
        }
      })
      .catch(() => {
        if (revision.current === current) {
          setSaveError(true);
          setSaving(false);
        }
      });
  }, [state, ready, saveAttempt]);

  const profile = state.profiles.find((item) => item.id === state.activeProfileId)!;
  const activeSession = state.activeSessions[profile.id];
  const updateActive = (update: (session: Session) => Session) =>
    setState((current) => {
      const active = current.activeSessions[current.activeProfileId];
      return active
        ? {
            ...current,
            activeSessions: {
              ...current.activeSessions,
              [current.activeProfileId]: update(active),
            },
          }
        : current;
    });
  const value: Store = {
    state,
    profile,
    activeSession,
    ready,
    loadError,
    saving,
    saveError,
    reload,
    retrySave: () => setSaveAttempt((v) => v + 1),
    switchProfile: (profileId) =>
      setState((current) =>
        current.profiles.some((p) => p.id === profileId)
          ? { ...current, activeProfileId: profileId }
          : current,
      ),
    saveProfile: (updated) =>
      setState((current) => ({
        ...current,
        profiles: current.profiles.some((p) => p.id === updated.id)
          ? current.profiles.map((p) => (p.id === updated.id ? updated : p))
          : [...current.profiles, updated],
        activeProfileId: updated.id,
      })),
    saveRoutine: (routine) =>
      setState((current) => ({
        ...current,
        routines: current.routines.some((r) => r.id === routine.id)
          ? current.routines.map((r) => (r.id === routine.id ? { ...routine, sample: false } : r))
          : [...current.routines, routine],
      })),
    deleteRoutine: (routineId) =>
      setState((current) => ({
        ...current,
        routines: current.routines.filter((r) => r.id !== routineId),
      })),
    begin: (routine) =>
      setState((current) =>
        current.activeSessions[routine.profileId]
          ? current
          : {
              ...current,
              activeSessions: {
                ...current.activeSessions,
                [routine.profileId]: startSession(routine, current.sessions),
              },
            },
      ),
    updateSet: (ei, si, patch) =>
      updateActive((session) => ({
        ...session,
        exercises: session.exercises.map((item, i) =>
          i === ei
            ? { ...item, sets: item.sets.map((set, j) => (j === si ? { ...set, ...patch } : set)) }
            : item,
        ),
      })),
    setTechnique: (ei, technique) =>
      updateActive((session) => ({
        ...session,
        exercises: session.exercises.map((item, i) => (i === ei ? { ...item, technique } : item)),
      })),
    setRest: (restEndsAt) => updateActive((session) => ({ ...session, restEndsAt })),
    finish: () => {
      if (!activeSession || completedSets(activeSession) === 0) return;
      const finished = { ...activeSession, finishedAt: new Date().toISOString() };
      setState((current) => {
        if (current.sessions.some((s) => s.id === finished.id)) return current;
        const activeSessions = { ...current.activeSessions };
        delete activeSessions[finished.profileId];
        return { ...current, activeSessions, sessions: [...current.sessions, finished] };
      });
      return finished;
    },
    discard: () =>
      setState((current) => {
        const activeSessions = { ...current.activeSessions };
        delete activeSessions[current.activeProfileId];
        return { ...current, activeSessions };
      }),
    addMeal: (meal) => setState((current) => ({ ...current, meals: [...current.meals, meal] })),
    removeMeal: (mealId) =>
      setState((current) => ({ ...current, meals: current.meals.filter((m) => m.id !== mealId) })),
    addMessages: (messages) =>
      setState((current) => ({
        ...current,
        messages: [...current.messages, ...messages].slice(-200),
      })),
    importState: (raw) => {
      const parsed = parseState(raw);
      setState(parsed);
      setLoadError(null);
      setReady(true);
    },
    clearExamples: () =>
      setState((current) => ({
        ...current,
        routines: current.routines.filter((r) => !r.sample),
        sessions: current.sessions.filter((s) => !s.sample),
      })),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider no está disponible.');
  return value;
}
