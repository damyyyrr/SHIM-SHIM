import { z } from "zod";
import { AppState, Exercise, Routine, Session, id } from "../domain/types";
import {
  completedSets,
  sessionVolume,
  startSession,
  validateExercise,
} from "../domain/training";
import { nutritionTotals } from "../domain/meals";
import { applyChangeSet, entityValue } from "./changes";
import { getForecasts } from "./forecast";
import { AssistantAction, ClientEffect, EntityPatch } from "./types";

export type ToolContext = {
  state: AppState;
  now: Date;
  today: string;
  availableProfiles: { id: string; name: string }[];
  recentActions?: { id: string; label: string }[];
};
export type ToolResult = {
  state: AppState;
  output: unknown;
  action?: AssistantAction;
};
type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodType;
  run: (args: unknown, context: ToolContext) => ToolResult;
};
const mode = z
  .enum(["apply", "propose"])
  .optional()
  .describe(
    "apply para un pedido explícito; propose para recomendaciones que el usuario aún no aceptó.",
  );
const text = (max = 150) => z.string().trim().min(1).max(max);
const optionalId = z.string().min(1).optional();
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const nutrition = z
  .object({
    calories: number(0, 20000),
    protein: number(0, 2000),
    carbs: number(0, 5000),
    fat: number(0, 2000),
  })
  .strict();
const exerciseFields = {
  name: text(),
  sets: number(1, 12).int(),
  minReps: number(1, 100).int(),
  maxReps: number(1, 100).int(),
  initialWeight: number(0, 1000),
  increment: number(0.01, 100),
  targetRir: number(0, 10).int(),
  restSeconds: number(0, 1800).int(),
  notes: z.string().max(3000),
};
const exerciseInput = z.object({ ...exerciseFields, id: optionalId }).strict();
const setFields = {
  weight: number(0, 1000).optional(),
  reps: number(1, 100).int().optional(),
  rir: number(0, 10).int().nullable().optional(),
  done: z.boolean().optional(),
};
function define<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  run: (args: z.infer<T>, ctx: ToolContext) => ToolResult,
): ToolDefinition {
  return {
    name,
    description,
    schema,
    run: (args, ctx) => run(schema.parse(args), ctx),
  };
}
function patch(
  ctx: ToolContext,
  collection: EntityPatch["collection"],
  recordId: string,
  after: unknown,
): EntityPatch {
  return {
    collection,
    id: recordId,
    before: entityValue(ctx.state, { collection, id: recordId }),
    after,
  };
}
function change(
  ctx: ToolContext,
  tool: string,
  label: string,
  patches: EntityPatch[],
  requestedMode?: "apply" | "propose",
  destructive = false,
): ToolResult {
  const proposal = destructive || requestedMode === "propose";
  const changeSet = {
    id: id(),
    profileId: ctx.state.activeProfileId,
    label,
    patches,
  };
  // Proposals are validated against the same rules without mutating the working context.
  const next = applyChangeSet(ctx.state, changeSet);
  return {
    state: proposal ? ctx.state : next,
    output: {
      status: proposal ? "pending_confirmation" : "applied",
      summary: label,
    },
    action: {
      id: changeSet.id,
      tool,
      label,
      status: proposal ? "pending" : "applied",
      change: changeSet,
    },
  };
}
function ownRoutine(ctx: ToolContext, routineId: string) {
  const routine = ctx.state.routines.find(
    (r) => r.id === routineId && r.profileId === ctx.state.activeProfileId,
  );
  if (!routine)
    throw new Error(
      "La rutina no existe en el perfil actual. Consultá inspect_app para obtener su ID.",
    );
  return routine;
}
function activeWorkout(ctx: ToolContext) {
  const session = ctx.state.activeSessions[ctx.state.activeProfileId];
  if (!session)
    throw new Error(
      "No hay una sesión en curso. Primero usá manage_workout con operation=start.",
    );
  return session;
}
function validateExercises(exercises: Exercise[]) {
  for (const exercise of exercises) {
    const error = validateExercise(exercise);
    if (error) throw new Error(error);
  }
  if (new Set(exercises.map((e) => e.id)).size !== exercises.length)
    throw new Error("Los ejercicios deben tener IDs distintos.");
}
const effectResult = (
  ctx: ToolContext,
  tool: string,
  label: string,
  effect: ClientEffect,
): ToolResult => ({
  state: ctx.state,
  output: { status: "client_action", summary: label },
  action: { id: id(), tool, label, status: "read", effect },
});

export const TOOLS: ToolDefinition[] = [
  define(
    "undo_last_change",
    "Deshace el último cambio aplicado por Mimo. Usar como última acción del turno. No deshace cambios manuales ni de otro perfil.",
    z.object({ action_id: optionalId }).strict(),
    (args, ctx) => {
      const recent = args.action_id
        ? ctx.recentActions?.find((a) => a.id === args.action_id)
        : ctx.recentActions?.at(-1);
      if (!recent)
        throw new Error(
          "No hay un cambio reciente de Mimo disponible para deshacer.",
        );
      return effectResult(
        ctx,
        "undo_last_change",
        `Deshacer: ${recent.label}`,
        { type: "undo", target: recent.id },
      );
    },
  ),
  define(
    "inspect_app",
    "Consulta datos reales del perfil actual: rutinas y IDs, sesión en curso, historial, comidas, objetivos y acciones recientes. Usar antes de inventar nombres o identificadores.",
    z
      .object({
        section: z.enum([
          "overview",
          "routines",
          "workout",
          "history",
          "meals",
          "profile",
          "profiles",
        ]),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .strict(),
    (args, ctx) => {
      const s = ctx.state,
        pid = s.activeProfileId,
        date = args.date ?? ctx.today;
      let output: unknown;
      if (args.section === "routines")
        output = s.routines.filter((r) => r.profileId === pid);
      else if (args.section === "workout")
        output = s.activeSessions[pid] ?? { message: "Sin sesión en curso." };
      else if (args.section === "profile")
        output = s.profiles.find((p) => p.id === pid);
      else if (args.section === "profiles") output = ctx.availableProfiles;
      else if (args.section === "history")
        output = s.sessions
          .filter((item) => item.profileId === pid)
          .sort((a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!))
          .slice(0, 12);
      else if (args.section === "meals") {
        const entries = s.meals.filter(
          (m) => m.profileId === pid && m.date === date,
        );
        output = {
          date,
          entries,
          totals: nutritionTotals(entries),
          targets: s.profiles.find((p) => p.id === pid)!.nutritionTargets,
        };
      } else
        output = {
          profile: s.profiles.find((p) => p.id === pid),
          routines: s.routines
            .filter((r) => r.profileId === pid)
            .map((r) => ({
              id: r.id,
              name: r.name,
              sample: r.sample,
              exercises: r.exercises.map((e) => ({ id: e.id, name: e.name })),
            })),
          activeWorkout: s.activeSessions[pid]
            ? {
                id: s.activeSessions[pid].id,
                name: s.activeSessions[pid].routineName,
                completedSets: completedSets(s.activeSessions[pid]),
              }
            : null,
          ownSessions: s.sessions.filter(
            (item) => item.profileId === pid && !item.sample,
          ).length,
        };
      return {
        state: s,
        output,
        action: {
          id: id(),
          tool: "inspect_app",
          label: `Consulté ${args.section === "routines" ? "tu rutina" : args.section === "history" ? "tu historial" : args.section === "meals" ? "tus comidas" : "tus datos"}`,
          status: "read",
        },
      };
    },
  ),
  define(
    "forecast_progression",
    "Calcula cuándo se podría evaluar subir la carga de cada ejercicio usando rango, incremento, RIR, técnica e historial real. Devuelve escenarios condicionales o datos insuficientes; nunca una fecha garantizada. Sin IDs devuelve todos los ejercicios.",
    z.object({ exercise_ids: z.array(z.string()).max(30).optional() }).strict(),
    (args, ctx) => {
      const forecasts = getForecasts(ctx.state, args.exercise_ids);
      return {
        state: ctx.state,
        output: forecasts,
        action: {
          id: id(),
          tool: "forecast_progression",
          label: "Revisé tu próxima progresión",
          status: "read",
          forecasts,
        },
      };
    },
  ),
  define(
    "save_routine",
    "Crea una rutina o reemplaza una existente del perfil actual. Para editar solo un ejercicio preferir edit_exercise. Conservar IDs existentes al reemplazar. Cargas, series y RIR son configurables.",
    z
      .object({
        routine_id: optionalId,
        name: text(100),
        focus: z.string().max(200),
        exercises: z.array(exerciseInput).min(1).max(30),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const existing = args.routine_id
        ? ownRoutine(ctx, args.routine_id)
        : undefined;
      const routine: Routine = {
        id: existing?.id ?? id(),
        profileId: ctx.state.activeProfileId,
        name: args.name,
        focus: args.focus,
        sample: false,
        exercises: args.exercises.map((e) => ({
          ...e,
          id:
            e.id ??
            existing?.exercises.find(
              (old) =>
                old.name.toLocaleLowerCase() === e.name.toLocaleLowerCase(),
            )?.id ??
            id(),
        })),
      };
      validateExercises(routine.exercises);
      return change(
        ctx,
        "save_routine",
        `${existing ? "Actualizar" : "Crear"} ${routine.name} · ${routine.exercises.length} ejercicios`,
        [patch(ctx, "routines", routine.id, routine)],
        args.mode,
      );
    },
  ),
  define(
    "edit_exercise",
    "Agrega, modifica, reordena o quita un ejercicio de una rutina. changes contiene solo los campos a cambiar; position es 1-based. Mantiene el historial anterior. Quitar requiere confirmación.",
    z
      .object({
        routine_id: text(),
        operation: z.enum(["add", "update", "remove", "move"]),
        exercise_id: optionalId,
        changes: z.object(exerciseFields).partial().strict().optional(),
        position: number(1, 30).int().optional(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const routine = ownRoutine(ctx, args.routine_id);
      let exercises = routine.exercises.map((e) => ({ ...e }));
      const ei = exercises.findIndex((e) => e.id === args.exercise_id);
      if (args.operation !== "add" && ei < 0)
        throw new Error("El ejercicio no existe en esta rutina.");
      if (args.operation === "add") {
        if (!args.changes?.name)
          throw new Error("Falta el nombre del nuevo ejercicio.");
        exercises.push({
          id: id(),
          name: args.changes.name,
          sets: 3,
          minReps: 8,
          maxReps: 12,
          initialWeight: 0,
          increment: 2.5,
          targetRir: 2,
          restSeconds: 90,
          notes: "",
          ...args.changes,
        });
      } else if (args.operation === "update")
        exercises[ei] = { ...exercises[ei], ...args.changes };
      else if (args.operation === "remove") exercises.splice(ei, 1);
      else {
        if (!args.position || args.position > exercises.length)
          throw new Error("La posición no es válida.");
        const [moved] = exercises.splice(ei, 1);
        exercises.splice(args.position - 1, 0, moved);
      }
      if (!exercises.length || exercises.length > 30)
        throw new Error("La rutina debe tener entre 1 y 30 ejercicios.");
      validateExercises(exercises);
      const name =
        args.operation === "add"
          ? args.changes!.name
          : routine.exercises[ei].name;
      return change(
        ctx,
        "edit_exercise",
        `${args.operation === "remove" ? "Quitar" : args.operation === "add" ? "Agregar" : "Actualizar"} ${name} en ${routine.name}`,
        [
          patch(ctx, "routines", routine.id, {
            ...routine,
            sample: false,
            exercises,
          }),
        ],
        args.mode,
        args.operation === "remove",
      );
    },
  ),
  define(
    "delete_routine",
    "Elimina una rutina conservando el historial. Siempre deja una propuesta que requiere confirmación.",
    z.object({ routine_id: text() }).strict(),
    (args, ctx) => {
      const routine = ownRoutine(ctx, args.routine_id);
      return change(
        ctx,
        "delete_routine",
        `Eliminar rutina ${routine.name}`,
        [patch(ctx, "routines", routine.id, null)],
        "propose",
        true,
      );
    },
  ),
  define(
    "manage_workout",
    "Controla toda la sesión: start (routine_id), record_set (exercise_id y set_number, peso/reps/RIR), technique, rest (segundos), finish o discard. Los números de serie empiezan en 1. record_set marca completada salvo done=false. finish guarda solo series completadas. discard pide confirmación.",
    z
      .object({
        operation: z.enum([
          "start",
          "record_set",
          "technique",
          "rest",
          "finish",
          "discard",
        ]),
        routine_id: optionalId,
        exercise_id: optionalId,
        set_number: number(1, 12).int().optional(),
        ...setFields,
        comfortable: z.boolean().optional(),
        seconds: number(0, 1800).int().optional(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const pid = ctx.state.activeProfileId;
      if (args.operation === "start") {
        if (ctx.state.activeSessions[pid])
          throw new Error(
            "Ya hay una sesión en curso. Consultala antes de empezar otra.",
          );
        if (!args.routine_id) throw new Error("Falta elegir la rutina.");
        const session = startSession(
          ownRoutine(ctx, args.routine_id),
          ctx.state.sessions,
          ctx.now,
        );
        return change(
          ctx,
          "manage_workout",
          `Empezar ${session.routineName}`,
          [patch(ctx, "activeSessions", pid, session)],
          args.mode,
        );
      }
      const active = activeWorkout(ctx);
      if (args.operation === "discard")
        return change(
          ctx,
          "manage_workout",
          `Descartar sesión ${active.routineName}`,
          [patch(ctx, "activeSessions", pid, null)],
          "propose",
          true,
        );
      if (args.operation === "finish") {
        if (!completedSets(active))
          throw new Error(
            "Registrá al menos una serie antes de guardar la sesión.",
          );
        const finished: Session = {
          ...active,
          restEndsAt: undefined,
          finishedAt: ctx.now.toISOString(),
        };
        return change(
          ctx,
          "manage_workout",
          `Guardar ${active.routineName} · ${completedSets(active)} series · ${sessionVolume(active)} kg de volumen`,
          [
            patch(ctx, "activeSessions", pid, null),
            patch(ctx, "sessions", finished.id, finished),
          ],
          args.mode,
        );
      }
      let next = {
        ...active,
        exercises: active.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => ({ ...s })),
        })),
      };
      if (args.operation === "rest")
        next.restEndsAt = args.seconds
          ? ctx.now.getTime() + args.seconds * 1000
          : undefined;
      else {
        const item = next.exercises.find(
          (e) => e.exercise.id === args.exercise_id,
        );
        if (!item)
          throw new Error("Falta un ejercicio válido de la sesión actual.");
        if (args.operation === "technique") {
          if (args.comfortable === undefined)
            throw new Error("Indicá cómo se sintió la técnica.");
          item.technique = args.comfortable;
        } else {
          if (!args.set_number || !item.sets[args.set_number - 1])
            throw new Error("La serie no existe en este ejercicio.");
          const set = item.sets[args.set_number - 1];
          if (args.weight !== undefined) set.weight = args.weight;
          if (args.reps !== undefined) set.reps = args.reps;
          if (args.rir !== undefined) set.rir = args.rir;
          set.done = args.done ?? true;
          if (set.done && item.exercise.restSeconds)
            next.restEndsAt =
              ctx.now.getTime() + item.exercise.restSeconds * 1000;
        }
      }
      return change(
        ctx,
        "manage_workout",
        args.operation === "record_set"
          ? `Registrar serie ${args.set_number} · ${next.exercises.find((e) => e.exercise.id === args.exercise_id)!.exercise.name}`
          : args.operation === "rest"
            ? `Descanso: ${args.seconds ?? 0} segundos`
            : "Actualizar técnica del ejercicio",
        [patch(ctx, "activeSessions", pid, next)],
        args.mode,
      );
    },
  ),
  define(
    "log_meal",
    "Registra o actualiza una comida y sus porciones. Valores por porción: calories en kcal; protein/carbs/fat en gramos. Si el usuario no aporta valores, aclarar que son estimaciones y proponer, no aplicar una dieta. date por defecto hoy. meal_id solo para editar.",
    z
      .object({
        meal_id: optionalId,
        name: text(),
        slot: z.enum([
          "Desayuno",
          "Almuerzo",
          "Merienda",
          "Cena",
          "Otra comida",
        ]),
        portions: number(0.1, 20),
        nutrition,
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const existing = args.meal_id
        ? ctx.state.meals.find(
            (m) =>
              m.id === args.meal_id &&
              m.profileId === ctx.state.activeProfileId,
          )
        : undefined;
      if (args.meal_id && !existing)
        throw new Error("La comida no existe en el perfil actual.");
      const meal = {
        id: existing?.id ?? id(),
        profileId: ctx.state.activeProfileId,
        name: args.name,
        slot: args.slot,
        portions: args.portions,
        nutrition: args.nutrition,
        date: args.date ?? ctx.today,
      };
      return change(
        ctx,
        "log_meal",
        `${existing ? "Actualizar" : "Registrar"} ${meal.name} · ${meal.portions} porciones`,
        [patch(ctx, "meals", meal.id, meal)],
        args.mode,
      );
    },
  ),
  define(
    "delete_meal",
    "Quita un registro de comida del perfil actual. Requiere confirmación.",
    z.object({ meal_id: text() }).strict(),
    (args, ctx) => {
      const meal = ctx.state.meals.find(
        (m) =>
          m.id === args.meal_id && m.profileId === ctx.state.activeProfileId,
      );
      if (!meal) throw new Error("No encontré esa comida en este perfil.");
      return change(
        ctx,
        "delete_meal",
        `Quitar ${meal.name}`,
        [patch(ctx, "meals", meal.id, null)],
        "propose",
        true,
      );
    },
  ),
  define(
    "update_profile",
    "Modifica nombre, meta, sesiones semanales o referencias nutricionales del perfil actual. Solo cambia los campos enviados. No inventar objetivos de calorías cuando falta información; pedirlos o proponerlos explícitamente.",
    z
      .object({
        name: text(60).optional(),
        goal: z
          .enum([
            "muscle",
            "fat-loss",
            "strength",
            "maintenance",
            "recomposition",
            "wellbeing",
          ])
          .optional(),
        weeklyTarget: number(1, 7).int().optional(),
        nutritionTargets: nutrition.partial().optional(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const profile = ctx.state.profiles.find(
        (p) => p.id === ctx.state.activeProfileId,
      )!;
      const { mode: requestedMode, nutritionTargets, ...fields } = args;
      const next = {
        ...profile,
        ...fields,
        nutritionTargets: { ...profile.nutritionTargets, ...nutritionTargets },
      };
      return change(
        ctx,
        "update_profile",
        "Actualizar tu perfil y objetivos",
        [patch(ctx, "profiles", profile.id, next)],
        requestedMode,
      );
    },
  ),
  define(
    "edit_history",
    "Corrige un registro guardado (serie, peso, reps, RIR o técnica), o elimina una sesión. No cambia la rutina. Eliminar siempre requiere confirmación.",
    z
      .object({
        session_id: text(),
        operation: z.enum(["update_set", "technique", "delete"]),
        exercise_id: optionalId,
        set_number: number(1, 12).int().optional(),
        ...setFields,
        comfortable: z.boolean().optional(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const session = ctx.state.sessions.find(
        (s) =>
          s.id === args.session_id && s.profileId === ctx.state.activeProfileId,
      );
      if (!session)
        throw new Error(
          "La sesión no existe en el historial del perfil actual.",
        );
      if (args.operation === "delete")
        return change(
          ctx,
          "edit_history",
          `Eliminar sesión ${session.routineName}`,
          [patch(ctx, "sessions", session.id, null)],
          "propose",
          true,
        );
      const next = {
        ...session,
        sample: false,
        exercises: session.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => ({ ...s })),
        })),
      };
      const item = next.exercises.find(
        (e) => e.exercise.id === args.exercise_id,
      );
      if (!item) throw new Error("El ejercicio no existe en esta sesión.");
      if (args.operation === "technique") {
        if (args.comfortable === undefined)
          throw new Error("Falta indicar la técnica.");
        item.technique = args.comfortable;
      } else {
        if (!args.set_number || !item.sets[args.set_number - 1])
          throw new Error("La serie no existe.");
        const set = item.sets[args.set_number - 1];
        for (const key of ["weight", "reps", "rir", "done"] as const) {
          if (args[key] !== undefined) Object.assign(set, { [key]: args[key] });
        }
      }
      return change(
        ctx,
        "edit_history",
        `Corregir ${item.exercise.name} en tu historial`,
        [patch(ctx, "sessions", next.id, next)],
        args.mode,
      );
    },
  ),
  define(
    "create_profile",
    "Crea un perfil local nuevo con la meta elegida, sin copiar datos privados de otro perfil. No cambia de perfil hasta que el usuario lo pida.",
    z
      .object({
        name: text(60),
        goal: z.enum([
          "muscle",
          "fat-loss",
          "strength",
          "maintenance",
          "recomposition",
          "wellbeing",
        ]),
        weeklyTarget: number(1, 7).int(),
        mode,
      })
      .strict(),
    (args, ctx) => {
      const profile = {
        id: id(),
        name: args.name,
        goal: args.goal,
        weeklyTarget: args.weeklyTarget,
        nutritionTargets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      };
      return change(
        ctx,
        "create_profile",
        `Crear perfil ${profile.name}`,
        [patch(ctx, "profiles", profile.id, profile)],
        args.mode,
      );
    },
  ),
  define(
    "switch_profile",
    "Cambia a un perfil existente por su ID. Consultar inspect_app section=profiles para los nombres. Usar como última acción del turno; los datos del otro perfil se consultan en el siguiente mensaje.",
    z.object({ profile_id: text() }).strict(),
    (args, ctx) => {
      if (!ctx.availableProfiles.some((p) => p.id === args.profile_id))
        throw new Error("Ese perfil no existe.");
      return effectResult(ctx, "switch_profile", "Cambiar de perfil", {
        type: "switch_profile",
        target: args.profile_id,
      });
    },
  ),
  define(
    "clear_examples",
    "Quita SOLO rutinas y sesiones de ejemplo del perfil actual; conserva datos propios y de otros perfiles. Requiere confirmación.",
    z.object({}).strict(),
    (_, ctx) => {
      const patches = [
        ...ctx.state.routines
          .filter((r) => r.profileId === ctx.state.activeProfileId && r.sample)
          .map((r) => patch(ctx, "routines", r.id, null)),
        ...ctx.state.sessions
          .filter((s) => s.profileId === ctx.state.activeProfileId && s.sample)
          .map((s) => patch(ctx, "sessions", s.id, null)),
      ];
      if (!patches.length)
        return {
          state: ctx.state,
          output: { message: "Este perfil no tiene datos de ejemplo." },
        };
      return change(
        ctx,
        "clear_examples",
        "Quitar los ejemplos de este perfil",
        patches,
        "propose",
        true,
      );
    },
  ),
  define(
    "open_app_view",
    "Abre una vista o inicia exportar/restaurar respaldos desde el dispositivo. No devuelve el archivo al modelo. El usuario elige el archivo y confirma la restauración localmente.",
    z
      .object({
        destination: z.enum([
          "routines",
          "workout",
          "meals",
          "progress",
          "profile",
          "export",
          "restore",
        ]),
      })
      .strict(),
    (args, ctx) =>
      effectResult(
        ctx,
        "open_app_view",
        args.destination === "export"
          ? "Preparar tu respaldo"
          : args.destination === "restore"
            ? "Abrir restauración de respaldo"
            : "Abrir tus datos",
        {
          type:
            args.destination === "export"
              ? "export"
              : args.destination === "restore"
                ? "restore"
                : "navigate",
          target: args.destination,
        },
      ),
  ),
];
export const TOOL_CATALOG = TOOLS.map((tool) => {
  const parameters = z.toJSONSchema(tool.schema, {
    target: "draft-7",
  }) as Record<string, any>;
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        ...parameters,
        properties: {
          ...parameters.properties,
          _continue: {
            type: "boolean",
            description:
              "false si esta herramienta completa el pedido y solo falta responder; true si necesitás otras herramientas después.",
          },
        },
      },
    },
  };
});
export function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): ToolResult {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Herramienta no permitida: ${name}`);
  return tool.run(args, ctx);
}
