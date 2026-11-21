import { AppState, Exercise, Routine, Session } from "../domain/types";
import { suggestProgression } from "../domain/training";
import { Forecast } from "./types";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.ceil((sorted.length - 1) / 2)]) /
        2
    : null;
}
export function forecastExercise(
  state: AppState,
  routine: Routine,
  exercise: Exercise,
): Forecast {
  const history = state.sessions
    .filter(
      (s) =>
        s.profileId === routine.profileId &&
        s.finishedAt &&
        s.exercises.some(
          (e) =>
            e.exercise.id === exercise.id && e.sets.some((set) => set.done),
        ),
    )
    .sort((a, b) => Date.parse(a.finishedAt!) - Date.parse(b.finishedAt!));
  const ownHistory = history.filter((s) => !s.sample);
  const evidence = ownHistory.length ? ownHistory : history;
  const last = evidence.at(-1);
  const performance = last?.exercises.find(
    (e) => e.exercise.id === exercise.id,
  );
  const completed = performance?.sets.filter((set) => set.done) ?? [];
  const next = suggestProgression(exercise, performance);
  const full = completed.length === exercise.sets;
  const uniform = completed.every((set) => set.weight === completed[0]?.weight);
  const weight = completed[0]?.weight ?? exercise.initialWeight;
  const remaining =
    full && uniform
      ? completed.reduce(
          (sum, set) => sum + Math.max(0, exercise.maxReps - set.reps),
          0,
        )
      : null;
  const cadence = median(
    evidence
      .slice(-5)
      .slice(1)
      .map(
        (s, i) =>
          (Date.parse(s.finishedAt!) -
            Date.parse(evidence.slice(-5)[i].finishedAt!)) /
          86400000,
      ),
  );
  const sameLoad = evidence
    .filter((s) => {
      const e = s.exercises.find((item) => item.exercise.id === exercise.id);
      return (
        e?.sets.length === exercise.sets &&
        e.sets.every((set) => set.done && set.weight === weight)
      );
    })
    .slice(-4);
  const improvements = sameLoad.slice(1).map((s, i) => {
    const sum = (session: Session) =>
      session.exercises
        .find((e) => e.exercise.id === exercise.id)!
        .sets.reduce(
          (total, set) => total + Math.min(exercise.maxReps, set.reps),
          0,
        );
    return sum(s) - sum(sameLoad[i]);
  });
  // A personal rate needs at least three real observations at the same load.
  // Otherwise show a clearly named hypothetical +1 rep/session scenario, not a promise.
  const rate =
    ownHistory.length >= 3 &&
    improvements.length >= 2 &&
    improvements.every((n) => n > 0)
      ? median(improvements)
      : null;
  const ready = next.status === "increase";
  const eligible =
    full &&
    uniform &&
    performance?.technique &&
    completed.every((set) => set.rir !== null && set.rir >= exercise.targetRir);
  const sessionsToQualify = ready
    ? 0
    : remaining !== null && remaining > 0 && eligible
      ? Math.ceil(remaining / (rate ?? 1))
      : null;
  const sessionsUntilIncrease =
    sessionsToQualify === null ? null : sessionsToQualify + 1;
  const basis: Forecast["basis"] = ready
    ? "ready"
    : sessionsToQualify === null
      ? "insufficient"
      : rate
        ? "observed"
        : "scenario";
  const conditions = [
    `Completar ${exercise.sets} series de ${exercise.maxReps} repeticiones con la misma carga.`,
    `Al menos ${exercise.targetRir} repeticiones en reserva en todas las series.`,
    "Mantener una técnica cómoda.",
  ];
  let explanation = next.reason;
  if (basis === "scenario")
    explanation = `Faltan ${remaining} repeticiones en total para completar el rango. Si sumaras una repetición total por sesión del ejercicio, cumplirías el rango en unas ${sessionsToQualify} sesiones y podrías evaluar la subida en la siguiente. No es una predicción de rendimiento.`;
  if (basis === "observed")
    explanation = `En ${sameLoad.length} sesiones propias a esta carga venís sumando aproximadamente ${rate} repeticiones totales por sesión. Si ese ritmo continuara, completarías el rango en unas ${sessionsToQualify} sesiones; la carga se evaluaría para la siguiente.`;
  if (!ownHistory.length && history.length)
    explanation = `Estos datos son de ejemplo, no tu rendimiento real. ${explanation}`;
  return {
    exerciseId: exercise.id,
    exercise: exercise.name,
    routine: routine.name,
    sample: !ownHistory.length && history.length > 0,
    currentWeight: weight,
    nextWeight: Math.round((weight + exercise.increment) * 100) / 100,
    currentReps: completed.map((s) => s.reps),
    targetReps: `${exercise.sets} × ${exercise.maxReps}`,
    missingReps: remaining,
    sessionsToQualify,
    sessionsUntilIncrease,
    estimatedDays:
      !last?.sample && cadence && sessionsUntilIncrease !== null
        ? Math.ceil(cadence * sessionsUntilIncrease)
        : null,
    cadenceDays: cadence ? Math.round(cadence * 10) / 10 : null,
    observations: ownHistory.length,
    basis,
    explanation,
    conditions,
  };
}
export function getForecasts(state: AppState, exerciseIds?: string[]) {
  return state.routines
    .filter((r) => r.profileId === state.activeProfileId)
    .flatMap((r) =>
      r.exercises
        .filter((e) => !exerciseIds?.length || exerciseIds.includes(e.id))
        .map((e) => forecastExercise(state, r, e)),
    );
}
