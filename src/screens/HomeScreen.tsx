import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useApp } from '../data/AppContext';
import { goalLabel, localDateKey, numberLabel } from '../domain/types';
import { lastPerformance, suggestProgression, thisWeekSessions } from '../domain/training';
import { nutritionTotals } from '../domain/meals';
import {
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  Icon,
  Meter,
  SectionTitle,
  shared,
  T,
} from '../ui/components';
import { Pet } from '../ui/Pet';
import { colors as c, fonts as f } from '../ui/theme';
export type Destination = 'home' | 'routines' | 'meals' | 'progress' | 'mimo' | 'workout';

export function HomeScreen({
  navigate,
  onProfile,
}: {
  navigate: (page: Destination) => void;
  onProfile: () => void;
}) {
  const { state, profile, activeSession, begin } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const routines = state.routines.filter((r) => r.profileId === profile.id);
  const routine = routines[0];
  const first = routine?.exercises[0];
  const suggestion = first
    ? suggestProgression(first, lastPerformance(state.sessions, profile.id, first.id))
    : undefined;
  const weekly = thisWeekSessions(state.sessions, profile.id);
  const today = localDateKey();
  const meals = state.meals.filter((m) => m.profileId === profile.id && m.date === today);
  const totals = nutritionTotals(meals);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return (
    <View style={shared.page}>
      <Heading eyebrow={`${greeting} · ${profile.name}`} subtitle="Un paso a la vez. A tu manera.">
        Cada repetición{wide ? ' ' : '\n'}te acerca.
      </Heading>
      <View
        style={[
          s.hero,
          { flexDirection: 'row' },
          wide ? { paddingVertical: 26 } : { padding: 19, gap: 0 },
        ]}
      >
        <View style={{ flex: 1, gap: 13, zIndex: 1 }}>
          <Badge background="#FFFFFFA8" color={c.green} icon="sparkles-outline">
            EN TU EQUIPO
          </Badge>
          <T style={[s.heroTitle, !wide && { fontSize: 23, lineHeight: 28 }]}>
            {wide ? 'Vos ponés las ganas.\nYo te acompaño.' : 'Con vos,\ncada día.'}
          </T>
          {wide && (
            <T style={s.heroCopy}>Un entrenamiento, una comida, un pequeño avance. Todo suma.</T>
          )}
          <Pressable accessibilityRole="button" onPress={() => navigate('mimo')} style={s.heroLink}>
            <T style={{ fontFamily: f.bold, fontSize: 12, color: c.green }}>Saludar a Mimo</T>
            <Icon name="arrow-forward" size={15} color={c.green} />
          </Pressable>
        </View>
        <View
          style={[s.petSpace, wide ? { width: 200, height: 200 } : { width: 118, height: 145 }]}
        >
          <View style={[s.petCircle, !wide && { width: 112, height: 112, top: 16 }]} />
          <Pet size={wide ? 190 : 120} onPress={() => navigate('mimo')} />
          {wide && (
            <View style={s.petTag}>
              <View style={s.statusDot} />
              <T style={{ fontSize: 10, fontFamily: f.bold, color: c.green }}>Mimo está con vos</T>
            </View>
          )}
        </View>
      </View>
      <View style={[s.columns, wide && { flexDirection: 'row' }]}>
        <View style={{ flex: 1.3, gap: 13 }}>
          <SectionTitle action="Mis rutinas" onAction={() => navigate('routines')}>
            Tu próximo entrenamiento
          </SectionTitle>
          {routine ? (
            <Card style={{ flex: 1, padding: 18, gap: 12 }}>
              <View style={shared.between}>
                <T style={[s.cardTitle, { flex: 1 }]}>
                  {activeSession?.routineName ?? routine.name}
                </T>
                <Badge icon={activeSession ? 'pause-circle-outline' : 'calendar-outline'}>
                  {activeSession ? 'En curso' : 'A tu ritmo'}
                </Badge>
              </View>
              <T muted style={{ fontSize: 12 }}>
                {routine.focus} · {routine.exercises.length} ejercicios
              </T>
              {suggestion && first && !activeSession && (
                <View style={s.nextStep}>
                  <Icon name="trending-up-outline" size={19} color={c.green} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontSize: 11, color: c.muted }}>Tu próximo paso · {first.name}</T>
                    <T style={{ fontFamily: f.bold }}>
                      {numberLabel(suggestion.weight)} kg <T muted>·</T>{' '}
                      {suggestion.reps.join(' / ')} reps
                    </T>
                  </View>
                </View>
              )}
              {activeSession && (
                <T muted style={{ fontSize: 12 }}>
                  Tu sesión está guardada. Continuá donde la dejaste.
                </T>
              )}
              <Button
                icon={activeSession ? 'play' : 'arrow-forward'}
                onPress={() => {
                  if (!activeSession) begin(routine);
                  navigate('workout');
                }}
              >
                {activeSession ? 'Continuar entrenamiento' : 'Vamos a entrenar'}
              </Button>
            </Card>
          ) : (
            <Card>
              <Empty
                icon="barbell-outline"
                title="Tu rutina empieza acá"
                detail="Agregá tus ejercicios y elegí cómo querés progresar."
                action="Crear mi primera rutina"
                onAction={() => navigate('routines')}
              />
            </Card>
          )}
        </View>
        <View style={{ flex: 1, gap: 13 }}>
          <SectionTitle action="Ver progreso" onAction={() => navigate('progress')}>
            Tu semana, sin apuro
          </SectionTitle>
          <Card style={{ flex: 1, gap: 16 }}>
            <View style={shared.between}>
              <T>
                <T style={s.weekNumber}>{weekly.length}</T>
                <T muted> / {profile.weeklyTarget} sesiones</T>
              </T>
              <Icon name="sunny-outline" color={c.green} size={23} />
            </View>
            <View style={s.week}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + i);
                const key = localDateKey(date);
                const done = weekly.some(
                  (session) => localDateKey(new Date(session.finishedAt!)) === key,
                );
                return (
                  <View
                    key={i}
                    accessibilityLabel={`${date.toLocaleDateString('es-UY', { weekday: 'long' })}${done ? ': entrenamiento completado' : key === today ? ': hoy' : ''}`}
                    style={s.day}
                  >
                    <T muted style={{ fontSize: 10 }}>
                      {day}
                    </T>
                    <View
                      style={[
                        s.dayDot,
                        done && { backgroundColor: c.green },
                        key === today && !done && { borderWidth: 1.5, borderColor: c.green },
                      ]}
                    >
                      {done ? (
                        <Icon name="checkmark" size={14} color={c.paper} />
                      ) : (
                        <T style={{ fontSize: 11, color: key === today ? c.green : c.muted }}>
                          {date.getDate()}
                        </T>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            <T muted style={{ fontSize: 12, lineHeight: 18 }}>
              {weekly.length >= profile.weeklyTarget
                ? '¡Cumpliste tu objetivo semanal! También hay lugar para descansar.'
                : 'Tu ritmo importa más que una racha perfecta. Los días de descanso también cuentan.'}
            </T>
            <View style={shared.rule} />
            <Pressable
              onPress={onProfile}
              accessibilityRole="button"
              style={[shared.between, { minHeight: 44 }]}
            >
              <View style={shared.row}>
                <Icon name="flag-outline" size={17} color={c.green} />
                <T style={{ fontSize: 12 }}>{goalLabel(profile.goal)}</T>
              </View>
              <Icon name="chevron-forward" size={15} color={c.muted} />
            </Pressable>
          </Card>
        </View>
      </View>
      <View>
        <SectionTitle action="Mis comidas" onAction={() => navigate('meals')}>
          También nos nutrimos
        </SectionTitle>
        <Card style={[s.foodCard, { marginTop: 10 }]}>
          <View style={s.foodIcon}>
            <T style={{ fontSize: 26, lineHeight: 34 }}>🥣</T>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <T style={{ fontFamily: f.bold }}>
              {meals.length
                ? `${meals.length} ${meals.length === 1 ? 'comida registrada' : 'comidas registradas'} hoy`
                : 'Un espacio para tus comidas'}
            </T>
            <T muted style={{ fontSize: 12 }}>
              {meals.length
                ? `${numberLabel(totals.calories, 0)} kcal · ${numberLabel(totals.protein, 0)} g de proteína registrados`
                : 'Tus favoritos, tus porciones y tus objetivos.'}
            </T>
            {profile.nutritionTargets.calories > 0 && (
              <Meter
                label="Calorías registradas"
                value={totals.calories}
                target={profile.nutritionTargets.calories}
              />
            )}
          </View>
          <Pressable
            accessibilityLabel="Registrar una comida"
            accessibilityRole="button"
            onPress={() => navigate('meals')}
            style={s.roundAction}
          >
            <Icon name="add" color={c.green} />
          </Pressable>
        </Card>
      </View>
      {state.sessions.some((session) => session.profileId === profile.id && session.sample) && (
        <View style={[shared.row, { justifyContent: 'center', flexWrap: 'wrap' }]}>
          <Icon name="leaf-outline" size={13} color={c.muted} />
          <T muted style={{ fontSize: 11 }}>
            Estás explorando con datos de ejemplo.
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={onProfile}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <T style={{ color: c.green, fontSize: 11, fontFamily: f.bold }}>Hacerlo mío →</T>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  hero: { backgroundColor: '#E6EDE2', borderRadius: 28, padding: 24, gap: 6, overflow: 'hidden' },
  heroTitle: {
    fontFamily: f.display,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.65,
    maxWidth: 340,
  },
  heroCopy: { fontSize: 13, lineHeight: 21, color: '#60765F', maxWidth: 300 },
  heroLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    alignSelf: 'flex-start',
  },
  petSpace: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    alignSelf: 'center',
    marginTop: -5,
  },
  petCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 100,
    backgroundColor: '#F2F5E9',
    top: 5,
  },
  petTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F8ED',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginTop: -4,
  },
  statusDot: { width: 5, height: 5, backgroundColor: c.green, borderRadius: 10 },
  columns: { gap: 21 },
  workoutIcon: {
    backgroundColor: c.greenSoft,
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: f.display, fontSize: 26, lineHeight: 34, letterSpacing: -0.5 },
  nextStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  weekNumber: { fontFamily: f.display, fontSize: 31, lineHeight: 38 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  day: { alignItems: 'center', gap: 6 },
  dayDot: {
    width: 29,
    height: 29,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.greenPale,
  },
  foodCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18 },
  foodIcon: {
    width: 50,
    height: 54,
    backgroundColor: c.yellowSoft,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundAction: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.greenSoft,
  },
});
