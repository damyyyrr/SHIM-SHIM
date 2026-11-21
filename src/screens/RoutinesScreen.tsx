import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp } from '../data/AppContext';
import { Exercise, Routine, id, numberLabel } from '../domain/types';
import { lastPerformance, suggestProgression, validateExercise } from '../domain/training';
import {
  Badge,
  Button,
  Card,
  Confirm,
  Empty,
  Field,
  Heading,
  Icon,
  IconButton,
  NumberField,
  Sheet,
  shared,
  T,
} from '../ui/components';
import { colors as c, fonts as f } from '../ui/theme';

export function RoutinesScreen({ onStart }: { onStart: (routine?: Routine) => void }) {
  const { state, profile, activeSession, saveRoutine, deleteRoutine } = useApp();
  const routines = state.routines.filter((r) => r.profileId === profile.id);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [error, setError] = useState('');
  function edit(routine?: Routine) {
    setError('');
    setEditing(
      routine
        ? { ...routine, exercises: routine.exercises.map((e) => ({ ...e })) }
        : { id: id(), profileId: profile.id, name: '', focus: '', exercises: [] },
    );
  }
  function patchExercise(index: number, patch: Partial<Exercise>) {
    setEditing(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((item, i) =>
            i === index ? { ...item, ...patch } : item,
          ),
        },
    );
  }
  function addExercise() {
    setEditing(
      (current) =>
        current && {
          ...current,
          exercises: [
            ...current.exercises,
            {
              id: id(),
              name: '',
              sets: 3,
              minReps: 8,
              maxReps: 12,
              initialWeight: 0,
              increment: 2.5,
              targetRir: 2,
              restSeconds: 90,
              notes: '',
            },
          ],
        },
    );
  }
  function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError('Poné un nombre a tu rutina.');
      return;
    }
    if (!editing.exercises.length) {
      setError('Agregá al menos un ejercicio.');
      return;
    }
    for (const [i, exercise] of editing.exercises.entries()) {
      const message = validateExercise(exercise);
      if (message) {
        setError(`Ejercicio ${i + 1}: ${message}`);
        return;
      }
    }
    saveRoutine({
      ...editing,
      name: editing.name.trim(),
      exercises: editing.exercises.map((e) => ({ ...e, name: e.name.trim() })),
    });
    setEditing(null);
  }
  return (
    <View style={shared.page}>
      <Heading
        eyebrow="Un plan que va con vos"
        subtitle="Tus ejercicios, tu ritmo y un próximo paso claro."
      >
        Mis rutinas
      </Heading>
      <Button icon="add" onPress={() => edit()} style={{ alignSelf: 'flex-start' }}>
        Crear rutina
      </Button>
      {activeSession && (
        <Card style={{ backgroundColor: c.lilacSoft, borderColor: 'transparent' }}>
          <T style={{ fontFamily: f.bold }}>
            Tenés una sesión en curso: {activeSession.routineName}
          </T>
          <Button
            variant="secondary"
            icon="play"
            onPress={() =>
              onStart(routines.find((r) => r.id === activeSession.routineId) ?? routines[0])
            }
          >
            Continuar sesión
          </Button>
        </Card>
      )}
      {!routines.length && (
        <Empty
          icon="barbell-outline"
          title="Hagamos lugar a tu rutina"
          detail="Creá una rutina con los ejercicios que ya hacés. Después podés ajustar cada detalle."
        />
      )}
      {routines.map((routine, ri) => (
        <Card key={routine.id}>
          <View style={shared.between}>
            <Badge icon="barbell-outline">{routine.exercises.length} ejercicios</Badge>
            <IconButton
              icon="ellipsis-horizontal"
              label={`Editar ${routine.name}`}
              onPress={() => edit(routine)}
            />
          </View>
          <View>
            <T style={s.routineTitle}>{routine.name}</T>
            <T muted style={{ fontSize: 12 }}>
              {routine.focus || 'Tu entrenamiento personalizado'}
            </T>
          </View>
          <View>
            {routine.exercises.map((exercise, i) => {
              const suggestion = suggestProgression(
                exercise,
                lastPerformance(state.sessions, profile.id, exercise.id),
              );
              return (
                <View
                  key={exercise.id}
                  style={[
                    s.exerciseRow,
                    i < routine.exercises.length - 1 && {
                      borderBottomWidth: 1,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <View style={s.exerciseIndex}>
                    <T style={{ fontFamily: f.bold, fontSize: 11, color: c.muted }}>
                      {String(i + 1).padStart(2, '0')}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontFamily: f.medium }}>{exercise.name}</T>
                    <T muted style={{ fontSize: 11 }}>
                      {exercise.sets} × {exercise.minReps}–{exercise.maxReps} reps ·{' '}
                      {exercise.restSeconds} s de descanso
                    </T>
                  </View>
                  <T style={{ fontFamily: f.bold, fontSize: 13 }}>
                    {numberLabel(suggestion.weight)}{' '}
                    <T muted style={{ fontSize: 10 }}>
                      kg
                    </T>
                  </T>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button icon="play" onPress={() => onStart(routine)} style={{ flex: 1 }}>
              Empezar
            </Button>
            <Button variant="secondary" icon="create-outline" onPress={() => edit(routine)}>
              Editar
            </Button>
            <IconButton
              icon="trash-outline"
              label={`Eliminar ${routine.name}`}
              danger
              onPress={() => setDeleting(routine)}
            />
          </View>
          {routine.sample && (
            <T muted style={{ fontSize: 10 }}>
              Rutina de ejemplo · adaptala a tu plan.
            </T>
          )}
        </Card>
      ))}
      <Sheet
        visible={!!editing}
        title={routines.some((r) => r.id === editing?.id) ? 'Editar rutina' : 'Tu nueva rutina'}
        onClose={() => setEditing(null)}
        footer={
          <Button onPress={save} icon="checkmark">
            Guardar rutina
          </Button>
        }
      >
        {editing && (
          <>
            <Field
              label="Nombre de la rutina"
              value={editing.name}
              onChangeText={(name) => setEditing({ ...editing, name })}
              placeholder="Por ejemplo: Torso A"
              maxLength={100}
            />
            <Field
              label="Enfoque (opcional)"
              value={editing.focus}
              onChangeText={(focus) => setEditing({ ...editing, focus })}
              placeholder="Pecho, espalda y hombros"
              maxLength={200}
            />
            {editing.exercises.map((exercise, i) => (
              <View key={exercise.id} style={s.editExercise}>
                <View style={shared.between}>
                  <T style={shared.title}>Ejercicio {i + 1}</T>
                  <View style={shared.row}>
                    {i > 0 && (
                      <IconButton
                        icon="arrow-up"
                        label={`Subir ejercicio ${i + 1}`}
                        onPress={() => {
                          const items = [...editing.exercises];
                          [items[i - 1], items[i]] = [items[i], items[i - 1]];
                          setEditing({ ...editing, exercises: items });
                        }}
                      />
                    )}
                    <IconButton
                      icon="trash-outline"
                      danger
                      label={`Quitar ejercicio ${i + 1}`}
                      onPress={() =>
                        setEditing({
                          ...editing,
                          exercises: editing.exercises.filter((_, j) => j !== i),
                        })
                      }
                    />
                  </View>
                </View>
                <Field
                  label="Ejercicio"
                  value={exercise.name}
                  onChangeText={(name) => patchExercise(i, { name })}
                  placeholder="Por ejemplo: Press de banca"
                  maxLength={150}
                />
                <View style={shared.row}>
                  <NumberField
                    label="Series"
                    value={exercise.sets}
                    onChange={(sets) => patchExercise(i, { sets })}
                    min={1}
                    max={12}
                    integer
                  />
                  <NumberField
                    label="Reps mín."
                    value={exercise.minReps}
                    onChange={(minReps) => patchExercise(i, { minReps })}
                    min={1}
                    max={100}
                    integer
                  />
                  <NumberField
                    label="Reps máx."
                    value={exercise.maxReps}
                    onChange={(maxReps) => patchExercise(i, { maxReps })}
                    min={1}
                    max={100}
                    integer
                  />
                </View>
                <View style={shared.row}>
                  <NumberField
                    label="Carga inicial · kg"
                    value={exercise.initialWeight}
                    onChange={(initialWeight) => patchExercise(i, { initialWeight })}
                  />
                  <NumberField
                    label="Incremento · kg"
                    value={exercise.increment}
                    onChange={(increment) => patchExercise(i, { increment })}
                    min={0.01}
                    max={100}
                  />
                </View>
                <View style={shared.row}>
                  <NumberField
                    label="Descanso · segundos"
                    value={exercise.restSeconds}
                    onChange={(restSeconds) => patchExercise(i, { restSeconds })}
                    max={1800}
                    integer
                  />
                  <NumberField
                    label="Reserva objetivo · RIR"
                    value={exercise.targetRir}
                    onChange={(targetRir) => patchExercise(i, { targetRir })}
                    max={10}
                    integer
                  />
                </View>
                <T style={shared.helper}>
                  RIR: cuántas repeticiones más sentís que podrías hacer al terminar una serie. Es
                  una condición para sugerir una subida de carga.
                </T>
                <Field
                  label="Notas (opcional)"
                  value={exercise.notes}
                  onChangeText={(notes) => patchExercise(i, { notes })}
                  multiline
                  placeholder="Técnica, equipo o peso por mancuerna…"
                  maxLength={3000}
                />
              </View>
            ))}
            <Button
              variant="secondary"
              icon="add"
              onPress={addExercise}
              disabled={editing.exercises.length >= 30}
            >
              Agregar ejercicio
            </Button>
            {!!error && (
              <T accessibilityRole="alert" style={shared.error}>
                {error}
              </T>
            )}
          </>
        )}
      </Sheet>
      <Confirm
        visible={!!deleting}
        title={`¿Eliminar ${deleting?.name ?? 'rutina'}?`}
        detail="Tu historial de entrenamientos se conserva."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteRoutine(deleting.id);
          setDeleting(null);
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  routineTitle: { fontFamily: f.display, fontSize: 28, lineHeight: 36, letterSpacing: -0.5 },
  exerciseRow: { paddingVertical: 13, gap: 10, flexDirection: 'row', alignItems: 'center' },
  exerciseIndex: {
    backgroundColor: c.background,
    borderRadius: 10,
    width: 31,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editExercise: { backgroundColor: c.greenPale, borderRadius: 18, padding: 15, gap: 13 },
});
