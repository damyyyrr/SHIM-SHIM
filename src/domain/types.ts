export type Goal =
  'muscle' | 'fat-loss' | 'strength' | 'maintenance' | 'recomposition' | 'wellbeing';
export type Nutrition = { calories: number; protein: number; carbs: number; fat: number };
export type Profile = {
  id: string;
  name: string;
  goal: Goal;
  weeklyTarget: number;
  nutritionTargets: Nutrition;
};
export type Exercise = {
  id: string;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  initialWeight: number;
  increment: number;
  targetRir: number;
  restSeconds: number;
  notes: string;
};
export type Routine = {
  id: string;
  profileId: string;
  name: string;
  focus: string;
  exercises: Exercise[];
  sample?: boolean;
};
export type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  rir: number | null;
  done: boolean;
};
export type SessionExercise = { exercise: Exercise; sets: WorkoutSet[]; technique: boolean };
export type Session = {
  id: string;
  profileId: string;
  routineId: string;
  routineName: string;
  startedAt: string;
  finishedAt?: string;
  restEndsAt?: number;
  exercises: SessionExercise[];
  sample?: boolean;
};
export type MealEntry = {
  id: string;
  profileId: string;
  date: string;
  name: string;
  slot: string;
  nutrition: Nutrition;
  portions: number;
};
export type ChatMessage = {
  id: string;
  profileId: string;
  role: 'user' | 'assistant';
  text: string;
};
export type AppState = {
  version: 1;
  activeProfileId: string;
  profiles: Profile[];
  routines: Routine[];
  sessions: Session[];
  activeSessions: Record<string, Session>;
  meals: MealEntry[];
  messages: ChatMessage[];
};
export type Suggestion = {
  weight: number;
  reps: number[];
  status: 'start' | 'increase' | 'build' | 'review';
  reason: string;
};

export const GOALS: { value: Goal; label: string; short: string; description: string }[] = [
  {
    value: 'muscle',
    label: 'Ganar masa muscular',
    short: 'Ganar músculo',
    description: 'Construir músculo con constancia.',
  },
  {
    value: 'fat-loss',
    label: 'Perder grasa',
    short: 'Perder grasa',
    description: 'Acompañar tu cambio y cuidar tu fuerza.',
  },
  {
    value: 'strength',
    label: 'Ganar fuerza',
    short: 'Ganar fuerza',
    description: 'Mejorar tu rendimiento en los ejercicios.',
  },
  {
    value: 'maintenance',
    label: 'Mantenerme',
    short: 'Mantenerme',
    description: 'Sostener lo que venís construyendo.',
  },
  {
    value: 'recomposition',
    label: 'Recomposición corporal',
    short: 'Recomposición',
    description: 'Combinar cambios en músculo y grasa.',
  },
  {
    value: 'wellbeing',
    label: 'Moverme y sentirme bien',
    short: 'Bienestar',
    description: 'Encontrar un ritmo que puedas disfrutar.',
  },
];

export const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
export const goalLabel = (goal: Goal) =>
  GOALS.find((item) => item.value === goal)?.short ?? 'Mi objetivo';
export const numberLabel = (value: number, digits = 1) =>
  value.toLocaleString('es-UY', { maximumFractionDigits: digits });
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
