import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useApp } from '../data/AppContext';
import { Session, numberLabel } from '../domain/types';
import { completedSets, sessionVolume, suggestProgression } from '../domain/training';
import {
  Badge,
  Card,
  Empty,
  Heading,
  Icon,
  SectionTitle,
  Sheet,
  shared,
  T,
} from '../ui/components';
import { colors as c, fonts as f } from '../ui/theme';

function LoadChart({ points }: { points: { time: number; weight: number }[] }) {
  const [width, setWidth] = useState(500);
  const left = 40,
    right = width - 16,
    top = 22,
    bottom = 150;
  const minValue = Math.max(0, Math.floor(Math.min(...points.map((p) => p.weight)) / 5) * 5 - 5);
  const maxValue = Math.ceil(Math.max(...points.map((p) => p.weight)) / 5) * 5 + 5;
  const minDate = points[0].time,
    maxDate = points[points.length - 1].time;
  const x = (time: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + ((time - minDate) / Math.max(1, maxDate - minDate)) * (right - left);
  const y = (weight: number) =>
    bottom - ((weight - minValue) / (maxValue - minValue)) * (bottom - top);
  const labels =
    points.length > 2
      ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
      : points;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 184 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Carga máxima por sesión, en kilogramos. ${points.map((point) => `${new Date(point.time).toLocaleDateString('es-UY')}: ${numberLabel(point.weight)} kg`).join('. ')}`}
    >
      <Svg width="100%" height={184} viewBox={`0 0 ${width} 184`}>
        {[minValue, (minValue + maxValue) / 2, maxValue].map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={left}
              x2={right}
              y1={y(value)}
              y2={y(value)}
              stroke={c.border}
              strokeWidth={1}
            />
            <SvgText
              x={left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={10}
              fill={c.muted}
              fontFamily={f.body}
            >
              {numberLabel(value)}
            </SvgText>
          </React.Fragment>
        ))}
        <Polyline
          points={points.map((point) => `${x(point.time)},${y(point.weight)}`).join(' ')}
          fill="none"
          stroke={c.green}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, i) => (
          <Circle
            key={`${point.time}-${i}`}
            cx={x(point.time)}
            cy={y(point.weight)}
            r={i === points.length - 1 ? 5 : 3.5}
            fill={c.green}
            stroke={c.paper}
            strokeWidth={2}
          />
        ))}
        {labels.map((point, i) => (
          <SvgText
            key={`${point.time}-${i}`}
            x={x(point.time)}
            y={175}
            textAnchor={
              labels.length > 1 && i === labels.length - 1
                ? 'end'
                : labels.length > 1 && i === 0
                  ? 'start'
                  : 'middle'
            }
            fontSize={10}
            fill={c.muted}
            fontFamily={f.body}
          >
            {new Date(point.time).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function ProgressScreen() {
  const { state, profile } = useApp();
  const sessions = state.sessions
    .filter((session) => session.profileId === profile.id && session.finishedAt)
    .sort((a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!));
  const exerciseOptions = [
    ...new Map(
      sessions.flatMap((session) =>
        session.exercises
          .filter((e) => e.sets.some((set) => set.done))
          .map((e) => [e.exercise.id, e.exercise] as const),
      ),
    ).values(),
  ];
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [viewing, setViewing] = useState<Session | null>(null);
  const selected = exerciseOptions.find((e) => e.id === selectedId) ?? exerciseOptions[0];
  const points = selected
    ? [...sessions].reverse().flatMap((session) => {
        const item = session.exercises.find((e) => e.exercise.id === selected.id);
        const done = item?.sets.filter((set) => set.done);
        return done?.length
          ? [
              {
                time: Date.parse(session.finishedAt!),
                weight: Math.max(...done.map((set) => set.weight)),
              },
            ]
          : [];
      })
    : [];
  const realSessions = sessions.filter((session) => !session.sample);
  return (
    <View style={shared.page}>
      <Heading
        eyebrow="Todo lo que venís construyendo"
        subtitle="Los pequeños avances también merecen verse."
      >
        Mirá hasta{'\n'}dónde llegaste.
      </Heading>
      <View style={s.stats}>
        <Card style={s.stat}>
          <Icon name="barbell-outline" color={c.green} />
          <T style={s.statNumber}>{realSessions.length}</T>
          <T muted style={{ fontSize: 11 }}>
            sesiones propias
          </T>
        </Card>
        <Card style={s.stat}>
          <Icon name="layers-outline" color={c.lilacInk} />
          <T style={s.statNumber}>
            {realSessions.reduce((sum, session) => sum + completedSets(session), 0)}
          </T>
          <T muted style={{ fontSize: 11 }}>
            series registradas
          </T>
        </Card>
      </View>
      {!sessions.length ? (
        <Empty
          icon="stats-chart-outline"
          title="Tu historia empieza con una serie"
          detail="Cuando guardes un entrenamiento, vas a ver tu evolución acá."
        />
      ) : (
        <>
          <SectionTitle>Tu fuerza, sesión a sesión</SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {exerciseOptions.map((exercise) => (
              <Pressable
                key={exercise.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === exercise.id }}
                onPress={() => setSelectedId(exercise.id)}
                style={[s.chip, selected?.id === exercise.id && { backgroundColor: c.green }]}
              >
                <T
                  style={{ fontSize: 12, color: selected?.id === exercise.id ? c.paper : c.green }}
                >
                  {exercise.name}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <Card>
            <View style={shared.between}>
              <View style={{ gap: 3, flex: 1 }}>
                <T style={{ fontFamily: f.bold }}>{selected?.name}</T>
                <T muted style={{ fontSize: 11 }}>
                  Carga máxima registrada por sesión · kg
                </T>
              </View>
              {points.length > 0 && (
                <T style={{ fontFamily: f.display, fontSize: 24 }}>
                  {numberLabel(points[points.length - 1].weight)}
                  <T muted style={{ fontSize: 11 }}>
                    {' '}
                    kg
                  </T>
                </T>
              )}
            </View>
            {points.length > 0 && <LoadChart points={points} />}
            {sessions.some(
              (session) =>
                session.sample && session.exercises.some((e) => e.exercise.id === selected?.id),
            ) && (
              <T muted style={{ fontSize: 10 }}>
                Incluye sesiones de ejemplo. Podés quitarlas desde tu perfil.
              </T>
            )}
          </Card>
          <SectionTitle>Tu historial</SectionTitle>
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver sesión ${session.routineName} del ${new Date(session.finishedAt!).toLocaleDateString('es-UY')}`}
              onPress={() => setViewing(session)}
            >
              <Card style={s.history}>
                <View style={s.date}>
                  <T style={{ fontFamily: f.display, fontSize: 21 }}>
                    {new Date(session.finishedAt!).getDate()}
                  </T>
                  <T style={{ color: c.muted, fontSize: 10, textTransform: 'uppercase' }}>
                    {new Date(session.finishedAt!).toLocaleDateString('es-UY', { month: 'short' })}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View
                    style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    <T style={{ fontFamily: f.bold }}>{session.routineName}</T>
                    {session.sample && (
                      <Badge background={c.background} color={c.muted}>
                        Ejemplo
                      </Badge>
                    )}
                  </View>
                  <T muted style={{ fontSize: 11 }}>
                    {completedSets(session)} series · {numberLabel(sessionVolume(session), 0)} kg de
                    volumen
                  </T>
                </View>
                <Icon name="chevron-forward" color={c.muted} size={17} />
              </Card>
            </Pressable>
          ))}
        </>
      )}
      <Sheet
        visible={!!viewing}
        title={viewing?.routineName ?? 'Entrenamiento'}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <>
            <T muted>
              {new Date(viewing.finishedAt!).toLocaleDateString('es-UY', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </T>
            {viewing.exercises.map((item) => (
              <View
                key={item.exercise.id}
                style={{ gap: 8, borderBottomWidth: 1, borderColor: c.border, paddingBottom: 15 }}
              >
                <T style={{ fontFamily: f.bold }}>{item.exercise.name}</T>
                {item.sets.filter((set) => set.done).length ? (
                  item.sets
                    .filter((set) => set.done)
                    .map((set, i) => (
                      <View key={set.id} style={shared.between}>
                        <T muted style={{ fontSize: 12 }}>
                          Serie {i + 1}
                        </T>
                        <T style={{ fontSize: 13 }}>
                          {numberLabel(set.weight)} kg × {set.reps} reps · RIR {set.rir ?? '—'}
                        </T>
                      </View>
                    ))
                ) : (
                  <T muted style={{ fontSize: 12 }}>
                    Sin series completadas.
                  </T>
                )}
              </View>
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}
const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 13 },
  stat: { flex: 1, gap: 5, padding: 20 },
  statNumber: { fontFamily: f.display, fontSize: 34, lineHeight: 42 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: c.greenSoft,
    justifyContent: 'center',
  },
  history: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  date: { minWidth: 44, alignItems: 'center', gap: 2 },
});
