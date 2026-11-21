import test from 'node:test';
import assert from 'node:assert/strict';
import { Exercise, SessionExercise } from '../src/domain/types';
import {
  completedSets,
  lastPerformance,
  sessionVolume,
  startSession,
  suggestProgression,
} from '../src/domain/training';
import { createInitialState } from '../src/domain/seed';

const exercise: Exercise = {
  id: 'bench',
  name: 'Banca',
  sets: 3,
  minReps: 8,
  maxReps: 12,
  initialWeight: 60,
  increment: 2.5,
  targetRir: 2,
  restSeconds: 90,
  notes: '',
};
function performance(reps = [12, 12, 12], rir: number | null = 2): SessionExercise {
  return {
    exercise: { ...exercise },
    technique: true,
    sets: reps.map((reps, i) => ({ id: String(i), weight: 60, reps, rir, done: true })),
  };
}
test('only suggests increasing after every set reaches the top with adequate effort and technique', () => {
  const next = suggestProgression(exercise, performance());
  assert.equal(next.status, 'increase');
  assert.equal(next.weight, 62.5);
  assert.deepEqual(next.reps, [8, 8, 8]);
});
test('missing or insufficient RIR prevents a load increase', () => {
  for (const rir of [null, 0, 1]) {
    const next = suggestProgression(exercise, performance([12, 12, 12], rir));
    assert.equal(next.weight, 60);
    assert.notEqual(next.status, 'increase');
  }
});
test('adds at most one repetition while building within the configured range', () => {
  const next = suggestProgression(exercise, performance([12, 12, 10]));
  assert.equal(next.weight, 60);
  assert.deepEqual(next.reps, [12, 12, 11]);
});
test('an incomplete session cannot qualify for more load', () => {
  const previous = performance();
  previous.sets[2].done = false;
  const next = suggestProgression(exercise, previous);
  assert.equal(next.weight, 60);
  assert.notEqual(next.status, 'increase');
});
test('a technique concern prevents any increase', () => {
  const previous = performance();
  previous.technique = false;
  assert.equal(suggestProgression(exercise, previous).status, 'review');
});
test('mixed loads require reviewing each set', () => {
  const previous = performance();
  previous.sets[1].weight = 55;
  assert.equal(suggestProgression(exercise, previous).status, 'review');
});
test('changing the prescribed set count cannot reuse an old qualifying session', () => {
  assert.equal(suggestProgression({ ...exercise, sets: 4 }, performance()).weight, 60);
});
test('fractional increments are kept exact', () => {
  assert.equal(suggestProgression({ ...exercise, increment: 0.1 }, performance()).weight, 60.1);
});
test('only completed sets count toward session volume', () => {
  const state = createInitialState();
  const session = startSession(state.routines[0], state.sessions);
  session.exercises[0].sets[0] = { id: 'one', weight: 60, reps: 10, rir: 2, done: true };
  assert.equal(sessionVolume(session), 600);
  assert.equal(completedSets(session), 1);
});
test('history lookups never mix profiles even when exercise identifiers match', () => {
  const state = createInitialState();
  const session = state.sessions[0];
  const exerciseId = session.exercises[0].exercise.id;
  assert.ok(lastPerformance(state.sessions, 'me', exerciseId));
  assert.equal(lastPerformance(state.sessions, 'partner', exerciseId), undefined);
});
test('starting a session snapshots its routine so edits do not rewrite an active workout', () => {
  const state = createInitialState();
  const routine = state.routines[0];
  const session = startSession(routine, state.sessions);
  routine.exercises[0].name = 'Edited';
  assert.notEqual(session.exercises[0].exercise.name, 'Edited');
  assert.equal(session.exercises[0].sets.length, 3);
  assert.ok(session.exercises.every((e) => e.sets.every((set) => !set.done && set.rir === null)));
});
