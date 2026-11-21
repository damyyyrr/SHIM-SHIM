import { z } from "zod";
import { AppState } from "../domain/types";
import { assistantActionSchema } from "../assistant/schema";
const finite = z.number().finite();
const nutrition = z.object({
  calories: finite.min(0).max(20000),
  protein: finite.min(0).max(2000),
  carbs: finite.min(0).max(5000),
  fat: finite.min(0).max(2000),
});
const exercise = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(150),
    sets: z.number().int().min(1).max(12),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
    initialWeight: finite.min(0).max(1000),
    increment: finite.positive().max(100),
    targetRir: z.number().int().min(0).max(10),
    restSeconds: z.number().int().min(0).max(1800),
    notes: z.string().max(3000),
  })
  .refine(
    (item) => item.minReps <= item.maxReps,
    "Rango de repeticiones inválido.",
  );
const iso = z.string().datetime();
const session = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  routineId: z.string().min(1),
  routineName: z.string().min(1),
  startedAt: iso,
  finishedAt: iso.optional(),
  restEndsAt: finite.nonnegative().optional(),
  sample: z.boolean().optional(),
  exercises: z
    .array(
      z.object({
        exercise,
        technique: z.boolean(),
        sets: z
          .array(
            z.object({
              id: z.string().min(1),
              weight: finite.min(0).max(1000),
              reps: z.number().int().min(1).max(100),
              rir: z.number().int().min(0).max(10).nullable(),
              done: z.boolean(),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .min(1)
    .max(30),
});
const stateSchema = z.object({
  version: z.literal(1),
  assistantServerUrl: z.string().max(500).optional(),
  activeProfileId: z.string(),
  profiles: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(60),
        goal: z.enum([
          "muscle",
          "fat-loss",
          "strength",
          "maintenance",
          "recomposition",
          "wellbeing",
        ]),
        weeklyTarget: z.number().int().min(1).max(7),
        nutritionTargets: nutrition,
      }),
    )
    .min(1)
    .max(20),
  routines: z.array(
    z.object({
      id: z.string().min(1),
      profileId: z.string().min(1),
      name: z.string().min(1).max(100),
      focus: z.string().max(200),
      sample: z.boolean().optional(),
      exercises: z.array(exercise).min(1).max(30),
    }),
  ),
  sessions: z.array(session),
  activeSessions: z.record(z.string(), session),
  meals: z.array(
    z.object({
      id: z.string().min(1),
      profileId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      name: z.string().min(1).max(150),
      slot: z.string().min(1),
      nutrition,
      portions: finite.positive().max(20),
    }),
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      role: z.enum(["user", "assistant"]),
      text: z.string().max(10000),
      actions: z.array(assistantActionSchema).max(40).optional(),
    }),
  ),
});
export function parseState(raw: string): AppState {
  if (raw.length > 5_000_000)
    throw new Error("El respaldo supera el tamaño admitido (5 MB).");
  const parsed = stateSchema.parse(JSON.parse(raw));
  const ids = new Set(parsed.profiles.map((profile) => profile.id));
  if (ids.size !== parsed.profiles.length || !ids.has(parsed.activeProfileId))
    throw new Error("Los perfiles del respaldo no son válidos.");
  for (const item of [
    ...parsed.routines,
    ...parsed.sessions,
    ...parsed.meals,
    ...parsed.messages,
  ]) {
    if (!ids.has(item.profileId))
      throw new Error("El respaldo contiene datos sin un perfil válido.");
  }
  for (const [profileId, active] of Object.entries(parsed.activeSessions)) {
    if (
      !ids.has(profileId) ||
      active.profileId !== profileId ||
      active.finishedAt
    )
      throw new Error("La sesión en curso no es válida.");
  }
  return parsed;
}
