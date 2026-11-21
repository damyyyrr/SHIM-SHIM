import { MealEntry, Nutrition } from './types';
export type MealOption = {
  id: string;
  name: string;
  detail: string;
  icon: string;
  tag: string;
  nutrition: Nutrition;
};
// Illustrative portions, not a prescribed menu. Users can enter label values via
// the custom-food form; targets are deliberately unset until the user defines them.
export const MEAL_OPTIONS: MealOption[] = [
  {
    id: 'yogurt',
    name: 'Yogur, avena y fruta',
    detail: 'Un bowl',
    icon: '🥣',
    tag: 'Vegetariano',
    nutrition: { calories: 340, protein: 24, carbs: 43, fat: 8 },
  },
  {
    id: 'chicken',
    name: 'Pollo, arroz y verduras',
    detail: 'Un plato',
    icon: '🥗',
    tag: 'Con carne',
    nutrition: { calories: 520, protein: 42, carbs: 65, fat: 10 },
  },
  {
    id: 'lentils',
    name: 'Lentejas con arroz',
    detail: 'Un plato',
    icon: '🍲',
    tag: 'Vegetal',
    nutrition: { calories: 460, protein: 22, carbs: 73, fat: 9 },
  },
  {
    id: 'eggs',
    name: 'Omelette con verduras',
    detail: 'Una porción',
    icon: '🍳',
    tag: 'Vegetariano',
    nutrition: { calories: 310, protein: 23, carbs: 12, fat: 19 },
  },
  {
    id: 'toast',
    name: 'Tostadas con queso y fruta',
    detail: 'Una porción',
    icon: '🍞',
    tag: 'Vegetariano',
    nutrition: { calories: 290, protein: 14, carbs: 39, fat: 9 },
  },
  {
    id: 'tuna',
    name: 'Sándwich de atún',
    detail: 'Un sándwich',
    icon: '🥪',
    tag: 'Con pescado',
    nutrition: { calories: 390, protein: 32, carbs: 40, fat: 11 },
  },
];
export const MEAL_SLOTS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Otra comida'];
export const emptyNutrition = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
export function nutritionTotals(entries: MealEntry[]): Nutrition {
  return entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.nutrition.calories * entry.portions,
      protein: total.protein + entry.nutrition.protein * entry.portions,
      carbs: total.carbs + entry.nutrition.carbs * entry.portions,
      fat: total.fat + entry.nutrition.fat * entry.portions,
    }),
    emptyNutrition(),
  );
}
