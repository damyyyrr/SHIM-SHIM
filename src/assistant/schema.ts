import { z } from "zod";
export const changeSetSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  label: z.string().max(500),
  patches: z
    .array(
      z.object({
        collection: z.enum([
          "profiles",
          "routines",
          "sessions",
          "meals",
          "activeSessions",
        ]),
        id: z.string(),
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .max(500),
});
export const forecastSchema = z.object({
  exerciseId: z.string(),
  exercise: z.string(),
  routine: z.string(),
  sample: z.boolean(),
  currentWeight: z.number().finite(),
  nextWeight: z.number().finite(),
  currentReps: z.array(z.number()),
  targetReps: z.string(),
  missingReps: z.number().nullable(),
  sessionsToQualify: z.number().nullable(),
  sessionsUntilIncrease: z.number().nullable(),
  estimatedDays: z.number().nullable(),
  cadenceDays: z.number().nullable(),
  observations: z.number(),
  basis: z.enum(["ready", "observed", "scenario", "insufficient"]),
  explanation: z.string(),
  conditions: z.array(z.string()),
});
export const assistantActionSchema = z.object({
  id: z.string(),
  tool: z.string(),
  label: z.string().max(500),
  status: z.enum(["read", "applied", "pending", "undone", "dismissed"]),
  change: changeSetSchema.optional(),
  effect: z
    .object({
      type: z.enum(["navigate", "export", "restore", "switch_profile", "undo"]),
      target: z.string().optional(),
    })
    .optional(),
  forecasts: z.array(forecastSchema).optional(),
});
export const assistantResponseSchema = z.object({
  text: z.string().max(20000),
  actions: z.array(assistantActionSchema).max(40),
  model: z.string(),
  requestId: z.string().min(1),
});
