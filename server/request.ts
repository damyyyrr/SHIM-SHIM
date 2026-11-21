import { z } from "zod";
export const assistantRequestSchema = z
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
