import assert from "node:assert/strict";
import { createInitialState } from "../src/domain/seed";
import { assistantResponseSchema } from "../src/assistant/schema";
import { applyChanges } from "../src/assistant/changes";
import { id, localDateKey } from "../src/domain/types";

async function main() {
  const state = createInitialState();
  const base = process.env.AI_SMOKE_URL ?? "http://127.0.0.1:8082";
  const cases = [
    "Mirando mi rutina y mi historial, ¿cuándo aproximadamente voy a poder aumentar el peso de mis ejercicios? Revisá los datos y explicame si son ejemplos o registros míos.",
    "Cambiá mi objetivo semanal a 4 sesiones. Hacelo en la aplicación, no me expliques cómo hacerlo manualmente.",
  ];
  for (const [index, text] of cases.entries()) {
    const start = Date.now();
    const response = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: id(),
        state,
        today: localDateKey(),
        messages: [{ role: "user", text }],
      }),
      signal: AbortSignal.timeout(300000),
    });
    const raw = await response.json();
    assert.equal(response.status, 200, JSON.stringify(raw));
    const result = assistantResponseSchema.parse(raw);
    if (index === 0)
      assert.ok(
        result.actions.some((a) => a.forecasts?.length),
        "La respuesta debe usar la herramienta de progresiones.",
      );
    else {
      const changes = result.actions
        .filter((a) => a.status === "applied" && a.change)
        .map((a) => a.change!);
      const after = applyChanges(state, changes);
      assert.equal(
        after.profiles.find((p) => p.id === state.activeProfileId)!
          .weeklyTarget,
        4,
        "El pedido debe producir un cambio real y validado.",
      );
    }
    console.log(
      JSON.stringify(
        {
          case: index + 1,
          seconds: Math.round((Date.now() - start) / 1000),
          tools: result.actions.map((a) => a.tool),
          response: result.text,
        },
        null,
        2,
      ),
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
