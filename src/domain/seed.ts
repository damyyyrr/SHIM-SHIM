import { AppState, Exercise, Profile, Routine, Session, id } from './types';

const exercise = (name: string, weight: number, extras: Partial<Exercise> = {}): Exercise => ({
  id: id(),
  name,
  sets: 3,
  minReps: 8,
  maxReps: 12,
  initialWeight: weight,
  increment: 2.5,
  targetRir: 2,
  restSeconds: 90,
  notes: '',
  ...extras,
});

export function createInitialState(now = new Date()): AppState {
  const profiles: Profile[] = [
    {
      id: 'me',
      name: 'Tu perfil',
      goal: 'muscle',
      weeklyTarget: 3,
      nutritionTargets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
    {
      id: 'partner',
      name: 'Otro perfil',
      goal: 'fat-loss',
      weeklyTarget: 3,
      nutritionTargets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
  ];
  const routines: Routine[] = profiles.flatMap((profile) => [
    {
      id: `upper-${profile.id}`,
      profileId: profile.id,
      name: 'Torso A',
      focus: 'Pecho, espalda y hombros',
      sample: true,
      exercises: [
        exercise('Press de banca', profile.id === 'me' ? 60 : 20),
        exercise('Remo en polea', profile.id === 'me' ? 45 : 25),
        exercise('Press de hombros', profile.id === 'me' ? 14 : 6, {
          increment: 1,
          notes: 'Registrar el peso de una mancuerna.',
        }),
        exercise('Jalón al pecho', profile.id === 'me' ? 45 : 25),
        exercise('Curl de bíceps', profile.id === 'me' ? 10 : 5, { increment: 1, restSeconds: 60 }),
      ],
    },
    {
      id: `lower-${profile.id}`,
      profileId: profile.id,
      name: 'Piernas A',
      focus: 'Cuádriceps, glúteos y posterior',
      sample: true,
      exercises: [
        exercise('Sentadilla', profile.id === 'me' ? 50 : 25, { restSeconds: 120 }),
        exercise('Peso muerto rumano', profile.id === 'me' ? 45 : 25),
        exercise('Prensa de piernas', profile.id === 'me' ? 100 : 60, { increment: 5 }),
        exercise('Curl femoral', profile.id === 'me' ? 25 : 15),
      ],
    },
  ]);
  const sessions: Session[] = profiles.flatMap((profile) => {
    const routine = routines.find((item) => item.profileId === profile.id)!;
    return [22, 18, 15, 11, 7, 3].map((offset, i) => {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      day.setHours(18, 0, 0, 0);
      return {
        id: id(),
        profileId: profile.id,
        routineId: routine.id,
        routineName: routine.name,
        sample: true,
        startedAt: day.toISOString(),
        finishedAt: new Date(day.getTime() + 42 * 60_000).toISOString(),
        exercises: routine.exercises.map((item) => ({
          exercise: { ...item },
          technique: true,
          sets: [0, 1, 2].map((_, setIndex) => ({
            id: id(),
            weight: Math.max(0, item.initialWeight - (5 - i) * item.increment),
            reps: i === 5 ? [12, 12, 10][setIndex] : [10, 10, 9][setIndex],
            rir: 2,
            done: true,
          })),
        })),
      };
    });
  });
  return {
    version: 1,
    activeProfileId: 'me',
    profiles,
    routines,
    sessions,
    activeSessions: {},
    meals: [],
    messages: [],
  };
}
