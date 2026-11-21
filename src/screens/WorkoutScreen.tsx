import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useApp } from '../data/AppContext';
import { Session, numberLabel } from '../domain/types';
import {
  completedSets,
  lastPerformance,
  sessionVolume,
  suggestProgression,
} from '../domain/training';
import {
  Badge,
  Button,
  Card,
  Confirm,
  Empty,
  Heading,
  Icon,
  IconButton,
  Meter,
  NumberField,
  SectionTitle,
  Sheet,
  shared,
  T,
} from '../ui/components';
import { colors as c, fonts as f } from '../ui/theme';
import { Pet } from '../ui/Pet';

export function WorkoutScreen({
  onBack,
  onProgress,
}: {
  onBack: () => void;
  onProgress: () => void;
}) {
  const {
    activeSession: session,
    profile,
    state,
    updateSet,
    setTechnique,
    setRest,
    finish,
    discard,
  } = useApp();
  const [index, setIndex] = useState(0);
  const [rirSet, setRirSet] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finished, setFinished] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setIndex(0);
  }, [session?.id]);
  function finishWorkout() {
    const saved = finish();
    if (saved) setFinished(saved);
    setConfirmFinish(false);
  }

  if (finished) {
    const minutes = Math.max(
      1,
      Math.round((Date.parse(finished.finishedAt!) - Date.parse(finished.startedAt)) / 60000),
    );
    return (
      <View style={shared.page}>
        <View style={{ alignItems: 'center', paddingTop: 15, gap: 14 }}>
          <Badge icon="sparkles-outline" background={c.lilacSoft} color={c.lilacInk}>
            UN PASITO MÁS
          </Badge>
          <Pet size={165} mood="celebrate" />
          <Heading subtitle="Tu sesión quedó registrada. Disfrutá este avance.">
            Lo hiciste. Y suma.
          </Heading>
        </View>
        <Card>
          <T style={shared.title}>{finished.routineName}</T>
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <T style={s.summaryValue}>{completedSets(finished)}</T>
              <T muted style={{ fontSize: 11 }}>
                series registradas
              </T>
            </View>
            <View style={s.summaryItem}>
              <T style={s.summaryValue}>{minutes}</T>
              <T muted style={{ fontSize: 11 }}>
                minutos
              </T>
            </View>
            <View style={s.summaryItem}>
              <T style={s.summaryValue}>{numberLabel(sessionVolume(finished), 0)}</T>
              <T muted style={{ fontSize: 11 }}>
                kg de volumen
              </T>
            </View>
          </View>
        </Card>
        <SectionTitle>La próxima vez</SectionTitle>
        {finished.exercises
          .filter((e) => e.sets.some((set) => set.done))
          .map((item) => {
            const next = suggestProgression(item.exercise, item);
            return (
              <Card key={item.exercise.id}>
                <View style={shared.between}>
                  <T style={{ fontFamily: f.bold, flex: 1 }}>{item.exercise.name}</T>
                  <Badge icon={next.status === 'increase' ? 'trending-up' : 'repeat'}>
                    {next.status === 'increase' ? 'Subir carga' : 'Seguir construyendo'}
                  </Badge>
                </View>
                <T style={s.nextLoad}>
                  {numberLabel(next.weight)} kg <T muted>· {next.reps.join(' / ')} reps</T>
                </T>
                <T muted style={{ fontSize: 12 }}>
                  {next.reason}
                </T>
              </Card>
            );
          })}
        <Button icon="stats-chart-outline" onPress={onProgress}>
          Ver mi progreso
        </Button>
        <Button variant="ghost" onPress={onBack}>
          Volver al inicio
        </Button>
      </View>
    );
  }
  if (!session)
    return (
      <Empty
        icon="barbell-outline"
        title="Todo listo para empezar"
        detail="Elegí una rutina y registrá tu próxima sesión."
        action="Volver a mis rutinas"
        onAction={onBack}
      />
    );
  const item = session.exercises[Math.min(index, session.exercises.length - 1)];
  const previous = lastPerformance(state.sessions, profile.id, item.exercise.id);
  const suggestion = suggestProgression(item.exercise, previous);
  const doneCount = completedSets(session);
  const totalSets = session.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const remaining = Math.max(0, Math.ceil(((session.restEndsAt ?? 0) - now) / 1000));
  const timerText = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  function toggleSet(si: number) {
    const done = !item.sets[si].done;
    updateSet(index, si, { done });
    if (done && item.exercise.restSeconds > 0)
      setRest(Date.now() + item.exercise.restSeconds * 1000);
  }
  return (
    <View style={shared.page}>
      <View style={shared.between}>
        <Button variant="ghost" icon="arrow-back" onPress={onBack} style={{ paddingHorizontal: 0 }}>
          Mi entrenamiento
        </Button>
        <Badge icon="cloud-done-outline">Sesión en curso</Badge>
      </View>
      <Heading
        eyebrow={session.routineName}
        subtitle="Registrá lo que hiciste. Tu próximo paso se construye acá."
      >
        Cada serie cuenta.
      </Heading>
      <View style={{ gap: 8 }}>
        <View style={shared.between}>
          <T muted style={{ fontSize: 12 }}>
            {doneCount} de {totalSets} series
          </T>
          <T style={{ fontFamily: f.bold, color: c.green, fontSize: 12 }}>
            {Math.round((doneCount / totalSets) * 100)} %
          </T>
        </View>
        <Meter label="Series completadas" value={doneCount} target={totalSets} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 3 }}
      >
        {session.exercises.map((exercise, i) => {
          const complete = exercise.sets.every((set) => set.done);
          return (
            <Pressable
              key={exercise.exercise.id}
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              onPress={() => setIndex(i)}
              style={[
                s.exerciseTab,
                i === index && { backgroundColor: c.green, borderColor: c.green },
              ]}
            >
              {complete && (
                <Icon name="checkmark-circle" size={16} color={i === index ? c.paper : c.green} />
              )}
              <T
                style={{ fontSize: 12, fontFamily: f.bold, color: i === index ? c.paper : c.muted }}
              >
                {i + 1}. {exercise.exercise.name}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <Card>
        <View style={shared.between}>
          <T style={{ fontFamily: f.display, fontSize: 25, lineHeight: 31, flex: 1 }}>
            {item.exercise.name}
          </T>
          <Badge>
            {item.exercise.minReps}–{item.exercise.maxReps} reps
          </Badge>
        </View>
        <View style={s.previous}>
          <Icon name="time-outline" size={16} color={c.muted} />
          <T muted style={{ fontSize: 12, flex: 1 }}>
            {previous
              ? `Última vez: ${numberLabel(previous.sets.find((set) => set.done)!.weight)} kg · ${previous.sets
                  .filter((set) => set.done)
                  .map((set) => set.reps)
                  .join(' / ')} reps`
              : 'Tu primera sesión en este ejercicio.'}
          </T>
        </View>
        <View style={s.prescription}>
          <View style={shared.row}>
            <Icon name="trending-up-outline" size={18} color={c.green} />
            <T style={{ fontFamily: f.bold, fontSize: 13 }}>
              Hoy: {numberLabel(suggestion.weight)} kg · {suggestion.reps.join(' / ')}
            </T>
          </View>
          <T style={{ fontSize: 12, lineHeight: 18, color: c.green }}>{suggestion.reason}</T>
        </View>
        {item.exercise.notes ? (
          <T muted style={{ fontSize: 12 }}>
            {item.exercise.notes}
          </T>
        ) : null}
        {item.sets.map((set, si) => (
          <View key={set.id} style={[s.setRow, set.done && { backgroundColor: c.greenPale }]}>
            <View style={{ width: 22, alignItems: 'center', paddingTop: 20 }}>
              <T style={{ color: c.muted, fontFamily: f.bold, fontSize: 12 }}>{si + 1}</T>
            </View>
            <NumberField
              label={`Kg · serie ${si + 1}`}
              value={set.weight}
              onChange={(weight) => updateSet(index, si, { weight, done: false })}
            />
            <NumberField
              label={`Reps · serie ${si + 1}`}
              value={set.reps}
              onChange={(reps) => updateSet(index, si, { reps, done: false })}
              min={1}
              max={100}
              integer
            />
            <View style={{ gap: 6, paddingTop: 0 }}>
              <T style={{ fontSize: 11, color: c.muted }}>RIR</T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Esfuerzo de la serie ${si + 1}: ${set.rir === null ? 'sin registrar' : set.rir + ' repeticiones en reserva'}`}
                onPress={() => setRirSet(si)}
                style={s.rir}
              >
                <T style={{ fontFamily: f.bold }}>{set.rir === null ? '—' : set.rir}</T>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Completar serie ${si + 1}`}
              accessibilityState={{ checked: set.done }}
              onPress={() => toggleSet(si)}
              style={[
                s.completeSet,
                set.done && { backgroundColor: c.green, borderColor: c.green },
              ]}
            >
              <Icon name="checkmark" color={set.done ? c.paper : c.muted} size={20} />
            </Pressable>
          </View>
        ))}
        <View style={[shared.between, { paddingTop: 8 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <T style={{ fontSize: 12, fontFamily: f.medium }}>La técnica se sintió cómoda</T>
            <T style={shared.helper}>Se tiene en cuenta para la progresión.</T>
          </View>
          <Switch
            accessibilityLabel="La técnica se sintió cómoda"
            value={item.technique}
            onValueChange={(value) => setTechnique(index, value)}
            trackColor={{ false: c.border, true: '#91B59B' }}
            thumbColor={item.technique ? c.green : '#FFFFFF'}
          />
        </View>
        <T style={{ fontSize: 11, color: c.muted, lineHeight: 17 }}>
          RIR = repeticiones que sentís que te quedaban. Si no lo registrás, la app no propone subir
          la carga.
        </T>
      </Card>
      {remaining > 0 && (
        <Card style={s.timer}>
          <View style={shared.row}>
            <Icon name="timer-outline" color={c.green} size={26} />
            <View>
              <T style={{ fontSize: 11, color: c.green }}>Respirá. Te lo ganaste.</T>
              <T accessibilityLabel={`Descanso: ${remaining} segundos`} style={s.time}>
                {timerText}
              </T>
            </View>
          </View>
          <View style={shared.row}>
            <Button
              variant="secondary"
              onPress={() => setRest(Math.max(Date.now(), session.restEndsAt ?? 0) + 30_000)}
              style={{ paddingHorizontal: 12 }}
            >
              +30 s
            </Button>
            <IconButton
              icon="play-skip-forward-outline"
              label="Terminar descanso"
              onPress={() => setRest(undefined)}
            />
          </View>
        </Card>
      )}
      <View style={shared.row}>
        {index > 0 && (
          <Button
            variant="secondary"
            icon="arrow-back"
            onPress={() => setIndex((i) => i - 1)}
            style={{ flex: 1 }}
          >
            Anterior
          </Button>
        )}
        {index < session.exercises.length - 1 && (
          <Button
            variant="secondary"
            icon="arrow-forward"
            onPress={() => setIndex((i) => i + 1)}
            style={{ flex: 1 }}
          >
            Siguiente ejercicio
          </Button>
        )}
      </View>
      <Button
        icon="checkmark-circle-outline"
        disabled={doneCount === 0}
        onPress={() => (doneCount < totalSets ? setConfirmFinish(true) : finishWorkout())}
      >
        Terminar y guardar sesión
      </Button>
      <Button variant="ghost" onPress={() => setDiscarding(true)}>
        Descartar esta sesión
      </Button>
      <Sheet
        visible={rirSet !== null}
        title="¿Cuántas más podrías hacer?"
        onClose={() => setRirSet(null)}
      >
        <T muted>Elegí las repeticiones que sentís que te quedaban al terminar esta serie.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rir) => (
            <Button
              key={rir}
              variant="secondary"
              onPress={() => {
                if (rirSet !== null) updateSet(index, rirSet, { rir });
                setRirSet(null);
              }}
              style={{ minWidth: 62 }}
            >
              {rir} RIR
            </Button>
          ))}
        </View>
        <Button
          variant="ghost"
          onPress={() => {
            if (rirSet !== null) updateSet(index, rirSet, { rir: null });
            setRirSet(null);
          }}
        >
          Dejar sin registrar
        </Button>
      </Sheet>
      <Confirm
        visible={discarding}
        title="¿Descartar la sesión?"
        detail="Se eliminarán las series de esta sesión en curso. Tu historial anterior se conserva."
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          discard();
          setDiscarding(false);
          onBack();
        }}
        confirmLabel="Descartar"
      />
      <Sheet
        visible={confirmFinish}
        title="¿Guardamos hasta acá?"
        onClose={() => setConfirmFinish(false)}
      >
        <T muted>
          Registraste {doneCount} de {totalSets} series. Guardaremos las que completaste; las demás
          no suman al volumen ni permiten una subida de carga.
        </T>
        <Button onPress={finishWorkout} icon="checkmark">
          Guardar sesión parcial
        </Button>
        <Button variant="ghost" onPress={() => setConfirmFinish(false)}>
          Seguir entrenando
        </Button>
      </Sheet>
    </View>
  );
}
const s = StyleSheet.create({
  exerciseTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.paper,
  },
  previous: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  prescription: { backgroundColor: c.greenSoft, padding: 14, borderRadius: 15, gap: 7 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: -9,
    padding: 7,
    borderRadius: 13,
  },
  rir: {
    width: 41,
    minHeight: 46,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.paper,
  },
  completeSet: {
    width: 40,
    height: 46,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  timer: {
    backgroundColor: c.greenSoft,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  time: {
    fontFamily: f.display,
    fontSize: 28,
    lineHeight: 34,
    color: c.green,
    fontVariant: ['tabular-nums'],
  },
  summary: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' },
  summaryItem: { flex: 1, minWidth: 75, gap: 2 },
  summaryValue: { fontFamily: f.display, fontSize: 28, lineHeight: 36 },
  nextLoad: { fontFamily: f.display, fontSize: 23, lineHeight: 31 },
});
