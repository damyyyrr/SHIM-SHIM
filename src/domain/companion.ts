import { AppState, localDateKey, numberLabel, Profile } from './types';
import { lastPerformance, suggestProgression } from './training';
import { nutritionTotals } from './meals';

export function companionReply(message: string, state: AppState, profile: Profile): string {
  const text = message
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/descans|cansad|agotad|faltar|pausa/.test(text))
    return 'Los días de descanso también forman parte del camino. Tu historial queda acá y podés retomar tu próxima sesión cuando estés listo. Yo te acompaño a tu ritmo. 🌿';
  if (/com|alimenta|proteina|arroz|huevo|caloria|nutri/.test(text)) {
    const entries = state.meals.filter(
      (m) => m.profileId === profile.id && m.date === localDateKey(),
    );
    const totals = nutritionTotals(entries);
    return entries.length
      ? `Hoy registraste ${entries.length} ${entries.length === 1 ? 'comida' : 'comidas'}: ${numberLabel(totals.calories, 0)} kcal y ${numberLabel(totals.protein, 0)} g de proteína.${profile.nutritionTargets.protein ? ` Tu referencia de proteína es ${profile.nutritionTargets.protein} g.` : ' Todavía no definiste referencias diarias.'} Podés editar las porciones o agregar una comida desde Comidas.`
      : 'Todavía no registraste comidas hoy. En Comidas podés agregar un ejemplo o cargar los valores de tu receta. Tus objetivos diarios se definen en tu perfil; no voy a inventar una dieta para vos. 🥣';
  }
  if (/carga|peso|progres|sub|repet|rutina|entrena|serie|fuerza|banca|sentadilla/.test(text)) {
    const routines = state.routines.filter((r) => r.profileId === profile.id);
    const exercises = routines.flatMap((r) => r.exercises);
    const exercise =
      exercises.find((e) =>
        text.includes(
          e.name
            .toLocaleLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        ),
      ) ??
      exercises.find((e) =>
        e.name
          .toLowerCase()
          .split(' ')
          .some((word) => word.length > 4 && text.includes(word)),
      ) ??
      exercises[0];
    if (!exercise)
      return 'Creá una rutina con tus ejercicios y tu rango de repeticiones. Con tu primer entrenamiento registrado vamos a tener un punto de partida para revisar el próximo paso. 💪';
    const previous = lastPerformance(state.sessions, profile.id, exercise.id);
    const next = suggestProgression(exercise, previous);
    return `Para ${exercise.name}, tu próximo objetivo es ${numberLabel(next.weight)} kg y ${next.reps.join(' / ')} repeticiones. ${next.reason} Esta sugerencia sale de tu regla de progresión y siempre podés ajustarla.`;
  }
  if (/hola|gracia|mimo|buen/.test(text))
    return '¡Acá estoy! Soy Mimo, tu compañero. Podés preguntarme por tu próxima carga, revisar lo que registraste hoy o charlar sobre un día de descanso. Cada paso cuenta. 💜';
  return 'En esta versión tengo respuestas guiadas sobre tu entrenamiento, tu registro de comidas y el descanso. Probá con «¿Cuál es mi próxima carga?» o «¿Qué comí hoy?». Cuando conectemos una IA vamos a poder conversar con más libertad.';
}
