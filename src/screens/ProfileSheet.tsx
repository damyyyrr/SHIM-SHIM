import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../data/AppContext";
import { GOALS, id, Profile, goalLabel } from "../domain/types";
import {
  Badge,
  Button,
  Field,
  Icon,
  NumberField,
  Sheet,
  shared,
  T,
} from "../ui/components";
import { colors as c, fonts as f } from "../ui/theme";
import { saveBackup } from "../data/backup";
import { parseState } from "../data/schema";

export function ProfileSheet({
  open,
  onClose,
  onProfileChanged,
  initialMode = "edit",
}: {
  open: boolean;
  onClose: () => void;
  onProfileChanged: () => void;
  initialMode?: "edit" | "import";
}) {
  const {
    state,
    profile,
    saveProfile,
    switchProfile,
    clearExamples,
    importState,
  } = useApp();
  const [draft, setDraft] = useState<Profile>(profile);
  const [mode, setMode] = useState<"edit" | "import" | "restore" | "clear">(
    "edit",
  );
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft({
        ...profile,
        nutritionTargets: { ...profile.nutritionTargets },
      });
      setMode(initialMode);
      setError("");
    }
  }, [open, profile.id]);
  function save() {
    if (!draft.name.trim()) {
      setError("Escribí un nombre para el perfil.");
      return;
    }
    saveProfile({ ...draft, name: draft.name.trim() });
    onProfileChanged();
    onClose();
  }
  async function exportData() {
    setWorking(true);
    setError("");
    try {
      await saveBackup(JSON.stringify(state, null, 2));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos exportar el respaldo.",
      );
    } finally {
      setWorking(false);
    }
  }
  function checkImport() {
    try {
      parseState(raw);
      setMode("restore");
      setError("");
    } catch {
      setError(
        "El respaldo no es válido o corresponde a otra versión. Revisá que hayas pegado el archivo JSON completo.",
      );
    }
  }
  const title =
    mode === "edit"
      ? "Tu espacio, a tu manera"
      : mode === "clear"
        ? "Empezar con mis datos"
        : mode === "restore"
          ? "Confirmar restauración"
          : "Restaurar un respaldo";
  return (
    <Sheet
      visible={open}
      title={title}
      onClose={onClose}
      footer={
        mode === "edit" ? (
          <Button icon="checkmark" onPress={save}>
            Guardar mi perfil
          </Button>
        ) : undefined
      }
    >
      {mode === "edit" ? (
        <>
          <T style={shared.label}>Perfiles en este dispositivo</T>
          <View style={{ gap: 8 }}>
            {state.profiles.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.id === item.id }}
                onPress={() => {
                  switchProfile(item.id);
                  setDraft({
                    ...item,
                    nutritionTargets: { ...item.nutritionTargets },
                  });
                  onProfileChanged();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor:
                    draft.id === item.id ? c.greenSoft : c.background,
                  padding: 13,
                  borderRadius: 15,
                  minHeight: 60,
                }}
              >
                <View
                  style={{
                    width: 35,
                    height: 35,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.paper,
                  }}
                >
                  <T style={{ fontFamily: f.bold, color: c.green }}>
                    {item.name.slice(0, 1).toLocaleUpperCase()}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: f.bold }}>{item.name}</T>
                  <T muted style={{ fontSize: 11 }}>
                    {goalLabel(item.goal)}
                  </T>
                </View>
                {draft.id === item.id && (
                  <Icon name="checkmark-circle" color={c.green} />
                )}
              </Pressable>
            ))}
          </View>
          <Button
            variant="ghost"
            icon="add"
            onPress={() => {
              setDraft({
                id: id(),
                name: "",
                goal: "wellbeing",
                weeklyTarget: 3,
                nutritionTargets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              });
              setError("");
            }}
            disabled={state.profiles.length >= 20}
          >
            Agregar otro perfil
          </Button>
          <View style={shared.rule} />
          <Field
            label="¿Cómo te llamamos?"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="Tu nombre"
            maxLength={60}
          />
          <T style={shared.label}>¿Qué querés construir?</T>
          <View style={{ gap: 8 }}>
            {GOALS.map((goal) => (
              <Pressable
                key={goal.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.goal === goal.value }}
                onPress={() => setDraft({ ...draft, goal: goal.value })}
                style={{
                  padding: 13,
                  borderWidth: 1,
                  borderColor: draft.goal === goal.value ? c.green : c.border,
                  borderRadius: 14,
                  backgroundColor:
                    draft.goal === goal.value ? c.greenPale : c.paper,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: f.bold, fontSize: 13 }}>
                    {goal.label}
                  </T>
                  <T muted style={{ fontSize: 11 }}>
                    {goal.description}
                  </T>
                </View>
                <Icon
                  name={
                    draft.goal === goal.value
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  color={draft.goal === goal.value ? c.green : c.border}
                  size={20}
                />
              </Pressable>
            ))}
          </View>
          <NumberField
            label="Tu referencia semanal · sesiones"
            value={draft.weeklyTarget}
            onChange={(weeklyTarget) => setDraft({ ...draft, weeklyTarget })}
            min={1}
            max={7}
            integer
          />
          <View style={shared.rule} />
          <T style={shared.title}>Tus referencias de alimentación</T>
          <T style={shared.helper}>
            Son objetivos que elegís vos o cargás de tu plan. Cambiar la meta
            del perfil no los modifica automáticamente. Dejá 0 si no querés
            definirlos todavía.
          </T>
          <View style={shared.row}>
            <NumberField
              label="Energía · kcal"
              value={draft.nutritionTargets.calories}
              max={20000}
              onChange={(calories) =>
                setDraft({
                  ...draft,
                  nutritionTargets: { ...draft.nutritionTargets, calories },
                })
              }
            />
            <NumberField
              label="Proteína · g"
              value={draft.nutritionTargets.protein}
              max={2000}
              onChange={(protein) =>
                setDraft({
                  ...draft,
                  nutritionTargets: { ...draft.nutritionTargets, protein },
                })
              }
            />
          </View>
          <View style={shared.row}>
            <NumberField
              label="Carbohidratos · g"
              value={draft.nutritionTargets.carbs}
              max={5000}
              onChange={(carbs) =>
                setDraft({
                  ...draft,
                  nutritionTargets: { ...draft.nutritionTargets, carbs },
                })
              }
            />
            <NumberField
              label="Grasas · g"
              value={draft.nutritionTargets.fat}
              max={2000}
              onChange={(fat) =>
                setDraft({
                  ...draft,
                  nutritionTargets: { ...draft.nutritionTargets, fat },
                })
              }
            />
          </View>
          <View style={shared.rule} />
          <T style={shared.title}>Tus datos</T>
          <T style={shared.helper}>
            Se guardan en este dispositivo. Estos perfiles no tienen contraseña
            ni se sincronizan entre celulares. El respaldo incluye todos los
            perfiles.
          </T>
          <Button
            variant="secondary"
            icon="download-outline"
            loading={working}
            onPress={() => {
              void exportData();
            }}
          >
            Exportar todos los perfiles
          </Button>
          <Button
            variant="ghost"
            icon="cloud-upload-outline"
            onPress={() => {
              setMode("import");
              setError("");
              setRaw("");
            }}
          >
            Restaurar un respaldo
          </Button>
          {(state.sessions.some((s) => s.sample) ||
            state.routines.some((r) => r.sample)) && (
            <Button
              variant="ghost"
              icon="leaf-outline"
              onPress={() => setMode("clear")}
            >
              Quitar los ejemplos y empezar
            </Button>
          )}
          <Badge background={c.background} color={c.muted}>
            SHIM-SHIM · Prototipo 0.1
          </Badge>
        </>
      ) : mode === "clear" ? (
        <>
          <T muted>
            Quitaremos las rutinas y sesiones de ejemplo de todos los perfiles.
            Las rutinas que editaste y tus registros propios se conservan.
          </T>
          <Button
            variant="danger"
            onPress={() => {
              clearExamples();
              setMode("edit");
            }}
          >
            Quitar datos de ejemplo
          </Button>
          <Button variant="ghost" onPress={() => setMode("edit")}>
            Volver
          </Button>
        </>
      ) : mode === "import" ? (
        <>
          <T muted>
            Pegá el contenido completo de un respaldo JSON exportado por esta
            app.
          </T>
          <Field
            label="Contenido del respaldo"
            value={raw}
            onChangeText={setRaw}
            multiline
            style={{ minHeight: 180, fontSize: 12 }}
            placeholder={'{ "version": 1, … }'}
            maxLength={5_000_000}
          />
          <Button icon="checkmark" onPress={checkImport}>
            Revisar respaldo
          </Button>
          <Button variant="ghost" onPress={() => setMode("edit")}>
            Volver
          </Button>
        </>
      ) : (
        <>
          <T muted>
            El respaldo es válido. Restaurarlo reemplazará todos los perfiles,
            rutinas y registros de este dispositivo. Podés exportar tus datos
            actuales antes de continuar.
          </T>
          <Button
            variant="secondary"
            loading={working}
            onPress={() => {
              void exportData();
            }}
          >
            Exportar datos actuales
          </Button>
          <Button
            variant="danger"
            onPress={() => {
              try {
                importState(raw);
                onProfileChanged();
                onClose();
              } catch {
                setError(
                  "No pudimos restaurar el respaldo. Tus datos actuales se conservaron.",
                );
              }
            }}
          >
            Reemplazar y restaurar
          </Button>
          <Button variant="ghost" onPress={() => setMode("import")}>
            Cancelar
          </Button>
        </>
      )}
      {!!error && (
        <T accessibilityRole="alert" style={shared.error}>
          {error}
        </T>
      )}
    </Sheet>
  );
}
