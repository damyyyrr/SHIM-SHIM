import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp } from '../data/AppContext';
import { id, localDateKey, numberLabel, Nutrition } from '../domain/types';
import {
  emptyNutrition,
  MEAL_OPTIONS,
  MEAL_SLOTS,
  nutritionTotals,
  MealOption,
} from '../domain/meals';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  IconButton,
  Meter,
  NumberField,
  SectionTitle,
  Sheet,
  shared,
  T,
} from '../ui/components';
import { colors as c, fonts as f } from '../ui/theme';

export function MealsScreen({ onTargets }: { onTargets: () => void }) {
  const { state, profile, addMeal, removeMeal } = useApp();
  const [date, setDate] = useState(localDateKey());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MealOption | null>(null);
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [nutrition, setNutrition] = useState<Nutrition>(emptyNutrition());
  const [portions, setPortions] = useState(1);
  const [slot, setSlot] = useState('Almuerzo');
  const [error, setError] = useState('');
  const entries = state.meals.filter((m) => m.profileId === profile.id && m.date === date);
  const totals = nutritionTotals(entries);
  const target = profile.nutritionTargets;
  function changeDate(delta: number) {
    const day = new Date(`${date}T12:00:00`);
    day.setDate(day.getDate() + delta);
    setDate(localDateKey(day));
  }
  function startMeal() {
    setOpen(true);
    setSelected(null);
    setCustom(false);
    setQuery('');
    setName('');
    setNutrition(emptyNutrition());
    setPortions(1);
    setError('');
  }
  function save() {
    const mealName = custom ? name.trim() : selected?.name;
    if (!mealName) {
      setError('Elegí una comida o escribí su nombre.');
      return;
    }
    addMeal({
      id: id(),
      profileId: profile.id,
      date,
      name: mealName,
      slot,
      nutrition: custom ? nutrition : selected!.nutrition,
      portions,
    });
    setOpen(false);
  }
  const dateLabel =
    date === localDateKey()
      ? 'Hoy'
      : new Date(`${date}T12:00:00`).toLocaleDateString('es-UY', { day: 'numeric', month: 'long' });
  return (
    <View style={shared.page}>
      <Heading eyebrow="Un espacio para nutrirte" subtitle="Tus comidas, sin complicarte el día.">
        Comer también{'\n'}es cuidarte.
      </Heading>
      <View style={shared.between}>
        <View style={shared.row}>
          <IconButton icon="chevron-back" label="Día anterior" onPress={() => changeDate(-1)} />
          <T style={{ fontFamily: f.bold }}>{dateLabel}</T>
          <IconButton icon="chevron-forward" label="Día siguiente" onPress={() => changeDate(1)} />
        </View>
        <Button icon="add" onPress={startMeal}>
          Registrar
        </Button>
      </View>
      <Card>
        <View style={shared.between}>
          <View>
            <T muted style={{ fontSize: 12 }}>
              Energía registrada
            </T>
            <T style={s.calories}>
              {numberLabel(totals.calories, 0)} <T muted>kcal</T>
            </T>
          </View>
          <Badge icon="restaurant-outline">
            {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
          </Badge>
        </View>
        {target.calories > 0 ? (
          <>
            <Meter
              label="Energía registrada respecto a tu referencia"
              value={totals.calories}
              target={target.calories}
            />
            <T muted style={{ fontSize: 12 }}>
              Tu referencia: {numberLabel(target.calories, 0)} kcal por día.
            </T>
          </>
        ) : (
          <T muted style={{ fontSize: 12 }}>
            Podés registrar comidas sin contar con un objetivo diario.
          </T>
        )}
        <View style={s.macros}>
          {(
            [
              { key: 'protein', label: 'Proteína', color: c.green },
              { key: 'carbs', label: 'Carbohidratos', color: c.lilacInk },
              { key: 'fat', label: 'Grasas', color: '#A17D38' },
            ] as const
          ).map((macro) => (
            <View key={macro.key} style={{ flex: 1, minWidth: 72, gap: 5 }}>
              <T style={{ fontSize: 11, color: c.muted }}>{macro.label}</T>
              <T style={{ fontFamily: f.bold, fontSize: 17 }}>
                {numberLabel(totals[macro.key], 0)}{' '}
                <T muted style={{ fontSize: 10 }}>
                  g
                </T>
              </T>
              {target[macro.key] > 0 && (
                <>
                  <Meter
                    label={macro.label}
                    value={totals[macro.key]}
                    target={target[macro.key]}
                    color={macro.color}
                  />
                  <T muted style={{ fontSize: 10 }}>
                    de {target[macro.key]} g
                  </T>
                </>
              )}
            </View>
          ))}
        </View>
        <Button
          variant="ghost"
          icon="options-outline"
          onPress={onTargets}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        >
          {target.calories ? 'Editar mis objetivos' : 'Definir mis objetivos'}
        </Button>
      </Card>
      <SectionTitle>Tu registro de {dateLabel.toLowerCase()}</SectionTitle>
      {!entries.length ? (
        <Card>
          <Empty
            icon="leaf-outline"
            title="¿Qué comiste hoy?"
            detail="Agregá una comida habitual o cargá los valores de su etiqueta."
            action="Registrar mi primera comida"
            onAction={startMeal}
          />
        </Card>
      ) : (
        MEAL_SLOTS.filter((group) => entries.some((entry) => entry.slot === group)).map((group) => (
          <Card key={group} style={{ paddingVertical: 15 }}>
            <T style={{ fontFamily: f.rounded, fontSize: 17 }}>{group}</T>
            {entries
              .filter((entry) => entry.slot === group)
              .map((entry) => (
                <View key={entry.id} style={shared.between}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontFamily: f.medium }}>{entry.name}</T>
                    <T muted style={{ fontSize: 11 }}>
                      {numberLabel(entry.portions)} {entry.portions === 1 ? 'porción' : 'porciones'}{' '}
                      · {numberLabel(entry.nutrition.calories * entry.portions, 0)} kcal ·{' '}
                      {numberLabel(entry.nutrition.protein * entry.portions, 0)} g proteína
                    </T>
                  </View>
                  <IconButton
                    icon="trash-outline"
                    label={`Quitar ${entry.name}`}
                    onPress={() => removeMeal(entry.id)}
                  />
                </View>
              ))}
          </Card>
        ))
      )}
      <View style={{ backgroundColor: c.yellowSoft, padding: 18, borderRadius: 18, gap: 5 }}>
        <T style={{ fontFamily: f.bold, fontSize: 13 }}>Tu plan puede cambiar con vos</T>
        <T style={{ fontSize: 12, color: '#88744F' }}>
          Elegí tus referencias diarias en tu perfil. Este prototipo registra lo que ingresás; no
          calcula ni prescribe una dieta.
        </T>
      </View>
      <Sheet
        visible={open}
        title="Registrar una comida"
        onClose={() => setOpen(false)}
        footer={
          selected || custom ? (
            <Button icon="checkmark" onPress={save}>
              Agregar a mi registro
            </Button>
          ) : undefined
        }
      >
        <T style={shared.label}>Momento del día</T>
        <View style={s.chips}>
          {MEAL_SLOTS.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: slot === item }}
              onPress={() => setSlot(item)}
              style={[s.chip, slot === item && s.selectedChip]}
            >
              <T style={{ fontSize: 12, color: slot === item ? c.paper : c.green }}>{item}</T>
            </Pressable>
          ))}
        </View>
        {!(selected || custom) ? (
          <>
            <Field
              label="Buscar entre los ejemplos"
              placeholder="Arroz, yogur, verduras…"
              value={query}
              onChangeText={setQuery}
            />
            <T style={shared.helper}>
              Valores orientativos por porción de ejemplo. Para cantidades exactas, cargá los de tu
              receta o etiqueta.
            </T>
            {MEAL_OPTIONS.filter((option) =>
              option.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            ).map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => {
                  setSelected(option);
                  setPortions(1);
                }}
                style={s.option}
              >
                <View style={s.foodEmoji}>
                  <T style={{ fontSize: 24, lineHeight: 32 }}>{option.icon}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: f.bold }}>{option.name}</T>
                  <T muted style={{ fontSize: 11 }}>
                    {option.nutrition.calories} kcal · {option.nutrition.protein} g proteína ·{' '}
                    {option.tag}
                  </T>
                </View>
              </Pressable>
            ))}
            <Button icon="add" variant="secondary" onPress={() => setCustom(true)}>
              Cargar mi propia comida
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              icon="arrow-back"
              onPress={() => {
                setSelected(null);
                setCustom(false);
              }}
            >
              Elegir otra comida
            </Button>
            {custom ? (
              <>
                <Field
                  label="Nombre de la comida"
                  value={name}
                  onChangeText={setName}
                  placeholder="Mi almuerzo"
                  maxLength={150}
                />
                <T style={shared.helper}>
                  Ingresá los valores de una porción según tu receta o etiqueta.
                </T>
                <View style={shared.row}>
                  <NumberField
                    label="Calorías · kcal"
                    value={nutrition.calories}
                    max={20000}
                    onChange={(calories) => setNutrition({ ...nutrition, calories })}
                  />
                  <NumberField
                    label="Proteína · g"
                    value={nutrition.protein}
                    max={2000}
                    onChange={(protein) => setNutrition({ ...nutrition, protein })}
                  />
                </View>
                <View style={shared.row}>
                  <NumberField
                    label="Carbohidratos · g"
                    value={nutrition.carbs}
                    max={5000}
                    onChange={(carbs) => setNutrition({ ...nutrition, carbs })}
                  />
                  <NumberField
                    label="Grasas · g"
                    value={nutrition.fat}
                    max={2000}
                    onChange={(fat) => setNutrition({ ...nutrition, fat })}
                  />
                </View>
              </>
            ) : (
              <Card style={{ backgroundColor: c.greenPale }}>
                <T style={{ fontFamily: f.display, fontSize: 22 }}>
                  {selected!.icon} {selected!.name}
                </T>
                <T muted>
                  {selected!.detail} · {selected!.nutrition.calories} kcal
                </T>
              </Card>
            )}
            <View style={shared.between}>
              <T style={{ fontFamily: f.bold }}>Porciones</T>
              <View style={shared.row}>
                <IconButton
                  icon="remove-circle-outline"
                  label="Quitar media porción"
                  onPress={() => setPortions((value) => Math.max(0.5, value - 0.5))}
                />
                <T style={{ fontFamily: f.bold, fontSize: 20 }}>{numberLabel(portions)}</T>
                <IconButton
                  icon="add-circle-outline"
                  label="Sumar media porción"
                  onPress={() => setPortions((value) => Math.min(20, value + 0.5))}
                />
              </View>
            </View>
            <T muted>
              Total:{' '}
              {numberLabel(
                (custom ? nutrition.calories : selected!.nutrition.calories) * portions,
                0,
              )}{' '}
              kcal ·{' '}
              {numberLabel(
                (custom ? nutrition.protein : selected!.nutrition.protein) * portions,
                0,
              )}{' '}
              g proteína.
            </T>
            {!!error && (
              <T accessibilityRole="alert" style={shared.error}>
                {error}
              </T>
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}
const s = StyleSheet.create({
  calories: { fontFamily: f.display, fontSize: 36, lineHeight: 46, letterSpacing: -1 },
  macros: {
    flexDirection: 'row',
    gap: 13,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 17,
    flexWrap: 'wrap',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: c.greenSoft,
    justifyContent: 'center',
  },
  selectedChip: { backgroundColor: c.green },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  foodEmoji: {
    width: 43,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
