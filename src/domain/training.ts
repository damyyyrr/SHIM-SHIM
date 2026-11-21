import { Exercise, Session, SessionExercise, Suggestion, id } from './types';

export function lastPerformance(
  sessions: Session[],
  profileId: string,
  exerciseId: string,
): SessionExercise | undefined {
  return [...sessions]
    .filter((session) => session.profileId === profileId && session.finishedAt)
    .sort((a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!))
    .flatMap((session) => session.exercises)
    .find((item) => item.exercise.id === exerciseId && item.sets.some((set) => set.done));
}

// Double progression is deterministic. Effort, technique and every prescribed set
// must be present before a load increase is suggested; the routine is never mutated.
export function suggestProgression(exercise: Exercise, previous?: SessionExercise): Suggestion {
  const start = {
    weight: exercise.initialWeight,
    reps: Array(exercise.sets).fill(exercise.minReps) as number[],
  };
  if (!previous || !previous.sets.some((set) => set.done)) {
    return {
      ...start,
      status: 'start',
      reason: 'Tu punto de partida. Podés ajustar la carga antes de empezar.',
    };
  }
  const completed = previous.sets.filter((set) => set.done);
  const baseWeight = completed[0].weight;
  const sameLoad = completed.every((set) => set.weight === baseWeight);
  const allSets = completed.length === exercise.sets;
  const allAtTop = allSets && completed.every((set) => set.reps >= exercise.maxReps);
  const effortReady = completed.every((set) => set.rir !== null && set.rir >= exercise.targetRir);
  if (allAtTop && effortReady && previous.technique && sameLoad) {
    return {
      weight: Math.round((baseWeight + exercise.increment) * 100) / 100,
      reps: Array(exercise.sets).fill(exercise.minReps),
      status: 'increase',
      reason: `Completaste ${exercise.sets} series al máximo del rango, con técnica cómoda y al menos ${exercise.targetRir} repeticiones en reserva. Incremento configurado: ${exercise.increment} kg.`,
    };
  }
  const reps = Array.from({ length: exercise.sets }, (_, i) => {
    const set = completed[i];
    return set
      ? Math.min(exercise.maxReps, Math.max(exercise.minReps, set.reps))
      : exercise.minReps;
  });
  let reason = 'Repetí la carga y seguí construyendo dentro de tu rango.';
  let status: Suggestion['status'] = 'build';
  if (!sameLoad) {
    reason = 'Usaste cargas distintas. Revisá cada serie antes de decidir una subida.';
    status = 'review';
  } else if (!allSets) {
    reason =
      'La sesión anterior quedó incompleta. Retomá la carga y completá las series previstas.';
  } else if (!previous.technique) {
    reason =
      'Marcaste que la técnica necesita revisión. Mantené una carga que puedas controlar y revisá el ejercicio.';
    status = 'review';
  } else if (allAtTop && !effortReady) {
    reason =
      'Llegaste al máximo del rango. Para proponer una subida falta registrar el esfuerzo o alcanzar la reserva configurada.';
  } else if (effortReady && previous.technique) {
    const next = reps.findIndex((rep) => rep < exercise.maxReps);
    if (next !== -1) reps[next] += 1;
    reason =
      'Mantenemos la carga y proponemos una repetición más en una serie. Podés ajustar el objetivo según cómo te sientas.';
  }
  return { weight: baseWeight, reps, status, reason };
}

export function startSession(
  routine: import('./types').Routine,
  sessions: Session[],
  now = new Date(),
): Session {
  return {
    id: id(),
    profileId: routine.profileId,
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now.toISOString(),
    exercises: routine.exercises.map((exercise) => {
      const suggestion = suggestProgression(
        exercise,
        lastPerformance(sessions, routine.profileId, exercise.id),
      );
      return {
        exercise: { ...exercise },
        technique: true,
        sets: Array.from({ length: exercise.sets }, (_, i) => ({
          id: id(),
          weight: suggestion.weight,
          reps: suggestion.reps[i],
          rir: null,
          done: false,
        })),
      };
    }),
  };
}

export function sessionVolume(session: Session) {
  return session.exercises.reduce(
    (total, item) =>
      total +
      item.sets.filter((set) => set.done).reduce((sum, set) => sum + set.weight * set.reps, 0),
    0,
  );
}
export const completedSets = (session: Session) =>
  session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.done).length,
    0,
  );

export function thisWeekSessions(sessions: Session[], profileId: string, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return sessions.filter(
    (session) =>
      session.profileId === profileId &&
      session.finishedAt &&
      Date.parse(session.finishedAt) >= start.getTime() &&
      Date.parse(session.finishedAt) <= now.getTime(),
  );
}

export function validateExercise(exercise: Exercise): string | undefined {
  if (!exercise.name.trim()) return 'Poné un nombre al ejercicio.';
  if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 12)
    return 'Elegí entre 1 y 12 series.';
  if (
    !Number.isInteger(exercise.minReps) ||
    !Number.isInteger(exercise.maxReps) ||
    exercise.minReps < 1 ||
    exercise.maxReps > 100 ||
    exercise.maxReps < exercise.minReps
  )
    return 'Revisá el rango de repeticiones (de 1 a 100).';
  if (
    !Number.isFinite(exercise.initialWeight) ||
    exercise.initialWeight < 0 ||
    exercise.initialWeight > 1000
  )
    return 'La carga debe estar entre 0 y 1000 kg.';
  if (!Number.isFinite(exercise.increment) || exercise.increment <= 0 || exercise.increment > 100)
    return 'El incremento debe ser mayor a 0 y hasta 100 kg.';
  if (!Number.isInteger(exercise.targetRir) || exercise.targetRir < 0 || exercise.targetRir > 10)
    return 'Las repeticiones en reserva deben estar entre 0 y 10.';
  if (
    !Number.isInteger(exercise.restSeconds) ||
    exercise.restSeconds < 0 ||
    exercise.restSeconds > 1800
  )
    return 'El descanso debe estar entre 0 y 1800 segundos.';
}
