import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useApp } from "../data/AppContext";
import { AssistantAction, ChangeSet, Forecast } from "./types";
import { numberLabel } from "../domain/types";
import { Badge, Button, Icon, shared, T } from "../ui/components";
import { colors as c, fonts as f } from "../ui/theme";

function describeChange(change: ChangeSet) {
  const lines: string[] = [];
  const labels: Record<string, string> = {
    name: "Nombre",
    sets: "Series",
    minReps: "Reps mínimas",
    maxReps: "Reps máximas",
    initialWeight: "Carga inicial (kg)",
    increment: "Incremento (kg)",
    targetRir: "Reserva (RIR)",
    restSeconds: "Descanso (s)",
    weeklyTarget: "Sesiones por semana",
    goal: "Meta",
    notes: "Notas",
  };
  for (const patch of change.patches) {
    const before = patch.before as Record<string, any> | null,
      after = patch.after as Record<string, any> | null;
    if (!after) {
      lines.push(`Quitar ${before?.name ?? before?.routineName ?? "registro"}`);
      continue;
    }
    if (patch.collection === "routines") {
      for (const exercise of after.exercises ?? []) {
        const old = before?.exercises?.find((e: any) => e.id === exercise.id);
        if (!old)
          lines.push(
            `${exercise.name}: ${exercise.sets} × ${exercise.minReps}–${exercise.maxReps} · ${numberLabel(exercise.initialWeight)} kg`,
          );
        else
          for (const key of Object.keys(labels))
            if (old[key] !== exercise[key])
              lines.push(
                `${exercise.name} · ${labels[key]}: ${old[key]} → ${exercise[key]}`,
              );
      }
      if (before && before.name !== after.name)
        lines.push(`Nombre: ${before.name} → ${after.name}`);
    } else if (patch.collection === "profiles") {
      for (const key of Object.keys(labels))
        if (before?.[key] !== after[key] && after[key] !== undefined)
          lines.push(`${labels[key]}: ${before?.[key] ?? "—"} → ${after[key]}`);
      for (const key of ["calories", "protein", "carbs", "fat"])
        if (before?.nutritionTargets?.[key] !== after.nutritionTargets?.[key])
          lines.push(
            `${({ calories: "Energía (kcal)", protein: "Proteína (g)", carbs: "Carbohidratos (g)", fat: "Grasas (g)" } as Record<string, string>)[key]}: ${before?.nutritionTargets?.[key] ?? 0} → ${after.nutritionTargets?.[key]}`,
          );
    } else if (patch.collection === "meals")
      lines.push(
        `${after.slot} · ${after.name} · ${after.portions} porciones · ${Math.round(after.nutrition.calories * after.portions)} kcal`,
      );
  }
  return lines.slice(0, 10);
}
export function ForecastCards({ forecasts }: { forecasts: Forecast[] }) {
  const [all, setAll] = useState(false),
    [detail, setDetail] = useState("");
  return (
    <View style={s.forecast}>
      <View style={shared.row}>
        <Icon name="trending-up-outline" color={c.green} size={18} />
        <T style={{ fontFamily: f.bold, fontSize: 13 }}>
          Tu próxima subida de carga
        </T>
      </View>
      {(all ? forecasts : forecasts.slice(0, 3)).map((item) => (
        <Pressable
          key={item.exerciseId}
          accessibilityRole="button"
          accessibilityLabel={`Ver cálculo de ${item.exercise}`}
          onPress={() =>
            setDetail(detail === item.exerciseId ? "" : item.exerciseId)
          }
          style={s.forecastRow}
        >
          <View style={shared.between}>
            <T style={{ fontFamily: f.bold, flex: 1 }}>{item.exercise}</T>
            <T style={{ fontFamily: f.bold, color: c.green }}>
              {numberLabel(item.currentWeight)} → {numberLabel(item.nextWeight)}{" "}
              kg
            </T>
          </View>
          <T muted style={{ fontSize: 11 }}>
            {item.currentReps.length
              ? item.currentReps.join(" / ") + " reps"
              : "Sin series registradas"}{" "}
            · objetivo {item.targetReps}
          </T>
          <View style={[shared.row, { flexWrap: "wrap", gap: 6 }]}>
            <Badge
              background={item.basis === "ready" ? c.greenSoft : c.yellowSoft}
              color={item.basis === "ready" ? c.green : "#876D39"}
            >
              {item.basis === "ready"
                ? "Podés evaluarlo en la próxima sesión"
                : item.sessionsUntilIncrease
                  ? `${item.basis === "scenario" ? "Escenario" : "Estimación"}: ${item.sessionsUntilIncrease} sesiones`
                  : "Faltan registros o condiciones"}
            </Badge>
            {item.sample && (
              <T muted style={{ fontSize: 10 }}>
                Datos de ejemplo
              </T>
            )}
          </View>
          {detail === item.exerciseId && (
            <View style={{ gap: 6, marginTop: 5 }}>
              <T style={{ fontSize: 12 }}>{item.explanation}</T>
              {item.conditions.map((condition) => (
                <T key={condition} muted style={{ fontSize: 11 }}>
                  • {condition}
                </T>
              ))}
              {item.estimatedDays !== null && (
                <T muted style={{ fontSize: 11 }}>
                  Si mantenés la frecuencia observada: aproximadamente{" "}
                  {item.estimatedDays} días.
                </T>
              )}
            </View>
          )}
        </Pressable>
      ))}
      {forecasts.length > 3 && (
        <Button variant="ghost" onPress={() => setAll(!all)}>
          {all ? "Ver menos" : `Ver los ${forecasts.length} ejercicios`}
        </Button>
      )}
    </View>
  );
}
export function ActionCard({
  action,
  messageId,
}: {
  action: AssistantAction;
  messageId: string;
}) {
  const { applyAssistantAction, dismissAssistantAction, undoAssistantAction } =
    useApp();
  const [error, setError] = useState("");
  if (action.forecasts) return <ForecastCards forecasts={action.forecasts} />;
  if (!action.change)
    return (
      <View style={[shared.row, { gap: 6 }]}>
        <Icon name="checkmark-circle-outline" size={13} color={c.muted} />
        <T muted style={{ fontSize: 11 }}>
          {action.label}
        </T>
      </View>
    );
  function run(callback: () => void) {
    try {
      callback();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo aplicar el cambio.",
      );
    }
  }
  const pending = action.status === "pending";
  const canUndo = action.tool !== "create_profile";
  const details = describeChange(action.change);
  return (
    <View
      style={[
        s.change,
        pending && { backgroundColor: c.yellowSoft, borderColor: "#E7DDC3" },
      ]}
    >
      <View style={shared.row}>
        <Icon
          name={
            pending
              ? "git-compare-outline"
              : action.status === "applied"
                ? "checkmark-circle"
                : "return-up-back-outline"
          }
          color={pending ? "#907445" : c.green}
          size={18}
        />
        <T style={{ fontFamily: f.bold, fontSize: 13, flex: 1 }}>
          {action.label}
        </T>
      </View>
      {details.map((line, i) => (
        <T key={i} style={{ fontSize: 12, color: c.muted }}>
          {line}
        </T>
      ))}
      {pending ? (
        <View style={shared.row}>
          <Button
            onPress={() =>
              run(() => applyAssistantAction(messageId, action.id))
            }
            style={{ flex: 1 }}
          >
            Aplicar cambios
          </Button>
          <Button
            variant="ghost"
            onPress={() => dismissAssistantAction(messageId, action.id)}
          >
            Descartar
          </Button>
        </View>
      ) : action.status === "applied" ? (
        <View style={shared.between}>
          <T style={{ fontSize: 11, color: c.green }}>Aplicado en tu app</T>
          {canUndo && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                run(() => undoAssistantAction(messageId, action.id))
              }
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <T style={{ fontSize: 12, fontFamily: f.bold, color: c.green }}>
                Deshacer
              </T>
            </Pressable>
          )}
        </View>
      ) : (
        <T muted style={{ fontSize: 11 }}>
          {action.status === "undone"
            ? "Cambio deshecho"
            : "Propuesta descartada"}
        </T>
      )}
      {!!error && (
        <T accessibilityRole="alert" style={shared.error}>
          {error}
        </T>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  forecast: {
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    padding: 17,
    gap: 13,
  },
  forecastRow: {
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 13,
    gap: 8,
  },
  change: {
    backgroundColor: c.greenPale,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 18,
    padding: 16,
    gap: 9,
  },
});
