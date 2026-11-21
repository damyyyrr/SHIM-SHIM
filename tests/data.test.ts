import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/seed';
import { parseState } from '../src/data/schema';
import { nutritionTotals } from '../src/domain/meals';
import { companionReply } from '../src/domain/companion';
import { localDateKey } from '../src/domain/types';

test('a full export can be restored without losing profile, routine or history data', () => {
  const state = createInitialState();
  assert.deepEqual(parseState(JSON.stringify(state)), state);
});
test('malformed and incompatible backups are rejected', () => {
  assert.throws(() => parseState('{broken'));
  assert.throws(() => parseState(JSON.stringify({ ...createInitialState(), version: 2 })));
});
test('orphaned data and a missing active profile are rejected', () => {
  const state = createInitialState();
  state.sessions[0].profileId = 'missing';
  assert.throws(() => parseState(JSON.stringify(state)));
  state.sessions = [];
  state.activeProfileId = 'missing';
  assert.throws(() => parseState(JSON.stringify(state)));
});
test('invalid negative weights cannot be imported', () => {
  const state = createInitialState();
  state.sessions[0].exercises[0].sets[0].weight = -5;
  assert.throws(() => parseState(JSON.stringify(state)));
});
test('meal totals multiply nutrients by portions and retain decimals', () => {
  const entry = {
    id: 'meal',
    profileId: 'me',
    name: 'Comida',
    date: '2026-11-20',
    slot: 'Almuerzo',
    portions: 1.5,
    nutrition: { calories: 300, protein: 20, carbs: 30, fat: 10 },
  };
  assert.deepEqual(nutritionTotals([entry]), { calories: 450, protein: 30, carbs: 45, fat: 15 });
});
test('new profiles have no invented nutritional prescription', () => {
  for (const profile of createInitialState().profiles)
    assert.deepEqual(profile.nutritionTargets, { calories: 0, protein: 0, carbs: 0, fat: 0 });
});
test('date keys use the local calendar date, not the UTC date', () => {
  const date = new Date(2026, 10, 20, 23, 50);
  assert.equal(localDateKey(date), '2026-11-20');
});
test('the guided companion uses the current profile rather than another profile’s meals', () => {
  const state = createInitialState();
  state.meals.push({
    id: 'meal',
    profileId: 'partner',
    date: localDateKey(),
    name: 'Comida',
    slot: 'Cena',
    portions: 1,
    nutrition: { calories: 100, protein: 10, carbs: 10, fat: 2 },
  });
  assert.match(
    companionReply('¿Qué comí hoy?', state, state.profiles[0]),
    /Todavía no registraste/,
  );
  assert.match(companionReply('¿Qué comí hoy?', state, state.profiles[1]), /100 kcal/);
});
