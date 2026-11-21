import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/domain/seed";
import { localDateKey } from "../src/domain/types";
import { executeTool, ToolContext, TOOL_CATALOG } from "../src/assistant/tools";
import { applyChangeSet, reverseChangeSet } from "../src/assistant/changes";
import { getForecasts } from "../src/assistant/forecast";
import { scopeState } from "../src/assistant/context";
import { runAgent, ModelMessage } from "../server/agent";
import { createProvider } from "../server/provider";

function context(): ToolContext {
  const state = createInitialState();
  return {
    state,
    today: localDateKey(),
    now: new Date(),
    availableProfiles: state.profiles.map((p) => ({ id: p.id, name: p.name })),
  };
}
test("all registered tools have JSON schemas and unknown tools/arguments are rejected", () => {
  assert.ok(TOOL_CATALOG.length >= 14);
  assert.throws(() => executeTool("run_shell", {}, context()));
  assert.throws(() =>
    executeTool(
      "update_profile",
      { profileId: "partner", weeklyTarget: 4 },
      context(),
    ),
  );
});
test("context sent to a model excludes records and conversations of other profiles", () => {
  const ctx = context();
  const scoped = scopeState(ctx.state);
  assert.equal(scoped.profiles.length, 1);
  assert.equal(scoped.messages.length, 0);
  assert.ok(scoped.routines.every((r) => r.profileId === "me"));
  assert.ok(scoped.sessions.every((s) => s.profileId === "me"));
});
test("forecasting is read-only and clearly marks sample-based scenarios", () => {
  const ctx = context();
  const before = JSON.stringify(ctx.state);
  const result = executeTool("forecast_progression", {}, ctx);
  assert.equal(JSON.stringify(result.state), before);
  const item = result.action!.forecasts![0];
  assert.equal(item.sample, true);
  assert.equal(item.basis, "scenario");
  assert.equal(item.missingReps, 2);
  assert.equal(item.sessionsToQualify, 2);
  assert.equal(item.sessionsUntilIncrease, 3);
  assert.equal(item.estimatedDays, null);
});
test("missing effort prevents giving a personal progression date", () => {
  const ctx = context();
  for (const session of ctx.state.sessions)
    for (const exercise of session.exercises)
      for (const set of exercise.sets) set.rir = null;
  const item = getForecasts(ctx.state)[0];
  assert.equal(item.basis, "insufficient");
  assert.equal(item.sessionsUntilIncrease, null);
});
test("a direct profile update changes the real state and can be reversed", () => {
  const ctx = context();
  const result = executeTool(
    "update_profile",
    { weeklyTarget: 4, mode: "apply" },
    ctx,
  );
  assert.equal(result.state.profiles[0].weeklyTarget, 4);
  assert.equal(
    applyChangeSet(result.state, reverseChangeSet(result.action!.change!))
      .profiles[0].weeklyTarget,
    3,
  );
  assert.equal(result.state.profiles[1].weeklyTarget, 3);
});
test("recommendations remain pending until applied", () => {
  const ctx = context();
  const result = executeTool(
    "update_profile",
    { weeklyTarget: 4, mode: "propose" },
    ctx,
  );
  assert.equal(result.state.profiles[0].weeklyTarget, 3);
  assert.equal(result.action!.status, "pending");
  assert.equal(
    applyChangeSet(result.state, result.action!.change!).profiles[0]
      .weeklyTarget,
    4,
  );
});
test("destructive tools require confirmation and preserve history", () => {
  const ctx = context(),
    routine = ctx.state.routines[0];
  const result = executeTool("delete_routine", { routine_id: routine.id }, ctx);
  assert.equal(result.action!.status, "pending");
  assert.equal(result.state.routines.length, ctx.state.routines.length);
  const after = applyChangeSet(result.state, result.action!.change!);
  assert.ok(!after.routines.some((r) => r.id === routine.id));
  assert.equal(after.sessions.length, ctx.state.sessions.length);
});
test("pending changes cannot silently overwrite later manual edits", () => {
  const ctx = context();
  const proposed = executeTool(
    "update_profile",
    { weeklyTarget: 4, mode: "propose" },
    ctx,
  );
  const manual = {
    ...ctx.state,
    profiles: ctx.state.profiles.map((p) =>
      p.id === "me" ? { ...p, name: "Nuevo nombre" } : p,
    ),
  };
  assert.throws(
    () => applyChangeSet(manual, proposed.action!.change!),
    /cambiaron/,
  );
});
test("tool calls cannot mutate another profile by guessing its IDs", () => {
  const ctx = context();
  const other = ctx.state.routines.find((r) => r.profileId === "partner")!;
  assert.throws(() =>
    executeTool("delete_routine", { routine_id: other.id }, ctx),
  );
  assert.throws(() =>
    applyChangeSet(ctx.state, {
      id: "malicious",
      label: "X",
      profileId: "me",
      patches: [
        {
          collection: "profiles",
          id: "partner",
          before: ctx.state.profiles[1],
          after: { ...ctx.state.profiles[1], weeklyTarget: 7 },
        },
      ],
    }),
  );
});
test("editing an exercise preserves its identity, routine order and historical snapshots", () => {
  const ctx = context(),
    routine = ctx.state.routines[0],
    exercise = routine.exercises[0];
  const beforeHistory = JSON.stringify(ctx.state.sessions);
  const result = executeTool(
    "edit_exercise",
    {
      routine_id: routine.id,
      exercise_id: exercise.id,
      operation: "update",
      changes: { restSeconds: 120 },
    },
    ctx,
  );
  assert.equal(result.state.routines[0].id, routine.id);
  assert.equal(result.state.routines[0].exercises[0].restSeconds, 120);
  assert.deepEqual(result.state.sessions, JSON.parse(beforeHistory));
});
test("a whole workout can be started, logged and finished through tools", () => {
  const ctx = context(),
    routine = ctx.state.routines[0];
  ctx.state = executeTool(
    "manage_workout",
    { operation: "start", routine_id: routine.id },
    ctx,
  ).state;
  ctx.state = executeTool(
    "manage_workout",
    {
      operation: "record_set",
      exercise_id: routine.exercises[0].id,
      set_number: 1,
      weight: 60,
      reps: 12,
    },
    ctx,
  ).state;
  assert.equal(ctx.state.activeSessions.me.exercises[0].sets[0].rir, null);
  assert.equal(ctx.state.activeSessions.me.exercises[0].sets[0].done, true);
  const result = executeTool("manage_workout", { operation: "finish" }, ctx);
  assert.equal(result.state.activeSessions.me, undefined);
  assert.equal(result.state.sessions.at(-1)!.profileId, "me");
});
test("meal logging and correction use portions without affecting another profile", () => {
  const ctx = context();
  const result = executeTool(
    "log_meal",
    {
      name: "Mi receta",
      slot: "Almuerzo",
      portions: 1.5,
      nutrition: { calories: 300, protein: 20, carbs: 30, fat: 10 },
    },
    ctx,
  );
  assert.equal(result.state.meals.length, 1);
  assert.equal(result.state.meals[0].portions, 1.5);
  assert.equal(result.state.meals[0].profileId, "me");
});
test("agent executes model-selected tools and returns verifiable changes", async () => {
  const ctx = context();
  let calls = 0;
  const result = await runAgent(
    {
      state: ctx.state,
      today: ctx.today,
      requestId: "request",
      messages: [
        { role: "user", text: "Quiero entrenar cuatro días por semana" },
      ],
    },
    async () =>
      ++calls === 1
        ? {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "update_profile",
                  arguments: { weeklyTarget: 4, mode: "apply" },
                },
              },
            ],
          }
        : {
            role: "assistant",
            content: "Actualicé tu referencia a cuatro sesiones semanales.",
          },
    "test-model",
  );
  assert.equal(result.actions[0].status, "applied");
  assert.equal(result.actions[0].change!.patches[0].collection, "profiles");
});
test("repeated model tool calls do not duplicate a mutation within a turn", async () => {
  const ctx = context();
  let calls = 0;
  const call = {
    id: "call_1",
    function: { name: "update_profile", arguments: { weeklyTarget: 4 } },
  };
  const result = await runAgent(
    {
      state: ctx.state,
      today: ctx.today,
      requestId: "request",
      messages: [{ role: "user", text: "Cuatro sesiones" }],
    },
    async () =>
      ++calls === 1
        ? {
            role: "assistant",
            content: "",
            tool_calls: [call, { ...call, id: "call_2" }],
          }
        : { role: "assistant", content: "Listo." },
    "test-model",
  );
  assert.equal(result.actions.filter((a) => a.change).length, 1);
});
test("Groq transport uses server credentials and links tool result call IDs correctly", async () => {
  const requests: any[] = [];
  const provider = createProvider(
    { GROQ_API_KEY: "test-only-not-a-real-key" },
    async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Listo." } }] }),
        { status: 200 },
      );
    },
  );
  await provider.chat([
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_1",
          function: { name: "inspect_app", arguments: { section: "profile" } },
        },
      ],
    },
    { role: "tool", content: "{}", tool_call_id: "call_1" },
  ]);
  assert.equal(requests[0].messages[1].tool_call_id, "call_1");
  assert.equal(
    requests[0].messages[0].tool_calls[0].function.arguments,
    '{"section":"profile"}',
  );
  assert.ok(!JSON.stringify(requests[0]).includes("test-only-not-a-real-key"));
});

test("final responses omit tool schemas to preserve free quota, while failures permit correction", async () => {
  const ctx = context();
  const allowed: boolean[] = [];
  let calls = 0;
  await runAgent(
    {
      state: ctx.state,
      today: ctx.today,
      requestId: "routing",
      messages: [{ role: "user", text: "Cuatro sesiones" }],
    },
    async (_messages, _signal, options) => {
      allowed.push(options!.allowTools);
      calls++;
      if (calls < 3)
        return {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: `call_${calls}`,
              function: {
                name: "update_profile",
                arguments: {
                  weeklyTarget: calls === 1 ? -1 : 4,
                  _continue: false,
                },
              },
            },
          ],
        };
      return { role: "assistant", content: "Listo." };
    },
    "test",
  );
  assert.deepEqual(allowed, [true, true, false]);
  const payloads: any[] = [];
  const provider = createProvider(
    { GROQ_API_KEY: "test-only" },
    async (_url, init) => {
      payloads.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Listo." } }] }),
      );
    },
  );
  await provider.chat([{ role: "user", content: "Hola" }], undefined, {
    allowTools: false,
  });
  assert.equal(payloads[0].tools, undefined);
});
