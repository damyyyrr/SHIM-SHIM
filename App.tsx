import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Nunito_900Black } from "@expo-google-fonts/nunito/900Black";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { AppProvider, useApp } from "./src/data/AppContext";
import { Button, Field, Icon, IconName, shared, T } from "./src/ui/components";
import { colors as c, fonts as f } from "./src/ui/theme";
import { Pet } from "./src/ui/Pet";
import { Destination } from "./src/screens/HomeScreen";
import { RoutinesScreen } from "./src/screens/RoutinesScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { MealsScreen } from "./src/screens/MealsScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { CompanionScreen } from "./src/screens/CompanionScreen";
import { ProfileSheet } from "./src/screens/ProfileSheet";
import { Routine, goalLabel } from "./src/domain/types";
import { ClientEffect } from "./src/assistant/types";
import { saveBackup } from "./src/data/backup";

const pages: {
  id: Destination;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}[] = [
  {
    id: "home",
    label: "Con Mimo",
    icon: "sparkles-outline",
    activeIcon: "sparkles",
  },
  {
    id: "routines",
    label: "Mi plan",
    icon: "barbell-outline",
    activeIcon: "barbell",
  },
  {
    id: "meals",
    label: "Comidas",
    icon: "restaurant-outline",
    activeIcon: "restaurant",
  },
  {
    id: "progress",
    label: "Historial",
    icon: "stats-chart-outline",
    activeIcon: "stats-chart",
  },
];
export default function App() {
  const [loaded, error] = useFonts({
    Nunito_800ExtraBold,
    Nunito_900Black,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  if (!loaded && !error)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={c.green} size="large" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const {
    state,
    getLatestState,
    profile,
    activeSession,
    begin,
    ready,
    loadError,
    saving,
    saveError,
    reload,
    retrySave,
    importState,
    switchProfile,
    undoAssistantAction,
  } = useApp();
  const [page, setPage] = useState<Destination>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMode, setProfileMode] = useState<"edit" | "import">("edit");
  const [recoveryRaw, setRecoveryRaw] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const inset = useSafeAreaInsets();
  function navigate(destination: Destination) {
    setPage(destination);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function start(routine?: Routine) {
    if (routine && !activeSession) begin(routine);
    navigate("workout");
  }
  async function handleAssistantEffect(effect: ClientEffect) {
    const state = getLatestState();
    if (effect.type === "undo") {
      const message = state.messages.find(
        (m) =>
          m.profileId === profile.id &&
          m.actions?.some(
            (a) => a.id === effect.target && a.status === "applied",
          ),
      );
      if (!message)
        throw new Error("No encontré un cambio disponible para deshacer.");
      undoAssistantAction(message.id, effect.target!);
      return;
    }
    if (effect.type === "export") {
      await saveBackup(JSON.stringify(state, null, 2));
      return;
    }
    if (effect.type === "restore") {
      setProfileMode("import");
      setProfileOpen(true);
      return;
    }
    if (effect.type === "switch_profile") {
      if (!state.profiles.some((p) => p.id === effect.target))
        throw new Error("No encontré el perfil.");
      switchProfile(effect.target!);
      navigate("home");
      return;
    }
    if (effect.type === "navigate") {
      if (effect.target === "profile") {
        setProfileMode("edit");
        setProfileOpen(true);
        return;
      }
      if (
        ["routines", "workout", "meals", "progress"].includes(
          effect.target ?? "",
        )
      )
        navigate(effect.target as Destination);
    }
  }
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (profileOpen) {
          setProfileOpen(false);
          return true;
        }
        if (page !== "home") {
          navigate("home");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [page, profileOpen]);
  if (loadError)
    return (
      <View style={[s.loading, { padding: 25, gap: 20 }]}>
        <Icon name="cloud-offline-outline" size={35} color={c.green} />
        <T style={shared.title}>Tus datos merecen cuidado</T>
        <T style={{ maxWidth: 440, textAlign: "center" }}>{loadError}</T>
        <Button
          onPress={() => {
            void reload();
          }}
          icon="refresh"
        >
          Volver a intentar
        </Button>
        <View style={{ maxWidth: 440, width: "100%", gap: 12 }}>
          <Field
            label="Restaurar desde un respaldo JSON"
            multiline
            value={recoveryRaw}
            onChangeText={setRecoveryRaw}
            placeholder="Pegá el respaldo exportado"
          />
          <Button
            variant="secondary"
            onPress={() => {
              try {
                importState(recoveryRaw);
              } catch {
                setRecoveryError(
                  "El respaldo no es válido. Revisá el archivo completo.",
                );
              }
            }}
          >
            Restaurar respaldo
          </Button>
          {recoveryError && <T style={shared.error}>{recoveryError}</T>}
        </View>
      </View>
    );
  if (!ready)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={c.green} />
        <T muted>Preparando tu espacio…</T>
      </View>
    );
  const assistantPage = page === "home" || page === "mimo";
  const currentPage = assistantPage
    ? "home"
    : page === "workout"
      ? "routines"
      : page;
  const saveLabel = saveError
    ? "No pudimos guardar"
    : saving
      ? "Guardando…"
      : "Guardado en este dispositivo";
  const date = new Date().toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View style={[s.app, { paddingTop: inset.top }]}>
      <StatusBar style="dark" />
      {desktop && (
        <View style={s.sidebar}>
          <View style={s.brand}>
            <View style={s.logo}>
              <Icon name="leaf" color={c.paper} size={21} />
            </View>
            <T style={s.wordmark}>
              shim<T style={[s.wordmark, { color: c.green }]}>shim.</T>
            </T>
          </View>
          <T style={s.sidebarLabel}>TU PEQUEÑO GRAN CAMBIO</T>
          <View style={{ gap: 8, marginTop: 36 }}>
            {pages.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.id === currentPage }}
                onPress={() => navigate(item.id)}
                style={({ pressed }) => [
                  s.sidebarItem,
                  item.id === currentPage && s.sidebarSelected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon
                  name={item.id === currentPage ? item.activeIcon : item.icon}
                  color={item.id === currentPage ? c.green : c.muted}
                  size={20}
                />
                <T
                  style={{
                    fontFamily: item.id === currentPage ? f.bold : f.medium,
                    color: item.id === currentPage ? c.green : c.muted,
                    flex: 1,
                  }}
                >
                  {item.label}
                </T>
                {item.id === "mimo" && <View style={s.onlineDot} />}
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.sidebarPet}>
            <Pet size={92} onPress={() => navigate("mimo")} />
            <T style={{ fontFamily: f.rounded, fontSize: 14 }}>
              Un poquito, cada día.
            </T>
            <T muted style={{ fontSize: 11, textAlign: "center" }}>
              Tu compañero está por acá.
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setProfileOpen(true)}
            style={s.sidebarProfile}
          >
            <View style={s.avatar}>
              <T style={{ fontFamily: f.bold, color: c.green }}>
                {profile.name.slice(0, 1).toLocaleUpperCase()}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T numberOfLines={1} style={{ fontFamily: f.bold, fontSize: 12 }}>
                {profile.name}
              </T>
              <T muted style={{ fontSize: 10 }}>
                {goalLabel(profile.goal)}
              </T>
            </View>
            <Icon name="chevron-expand" color={c.muted} size={17} />
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={[
            s.topbar,
            desktop
              ? { paddingHorizontal: 38, height: 83 }
              : { paddingHorizontal: 20, height: 73 },
          ]}
        >
          {desktop ? (
            <View style={shared.row}>
              <View style={s.onlineDot} />
              <T muted style={{ fontSize: 12 }}>
                Tu espacio para crecer
              </T>
            </View>
          ) : (
            <View style={[s.brand, { gap: 8 }]}>
              <View
                style={[s.logo, { width: 28, height: 31, borderRadius: 10 }]}
              >
                <Icon name="leaf" size={16} color={c.paper} />
              </View>
              <T style={[s.wordmark, { fontSize: 23 }]}>
                shim
                <T style={[s.wordmark, { color: c.green, fontSize: 23 }]}>
                  shim.
                </T>
              </T>
            </View>
          )}
          <View style={shared.row}>
            {desktop && (
              <T
                muted
                style={{
                  fontSize: 11,
                  marginRight: 12,
                  textTransform: "capitalize",
                }}
              >
                {date}
              </T>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil y objetivos"
              onPress={() => setProfileOpen(true)}
              style={[s.avatar, { width: 38, height: 38, borderRadius: 14 }]}
            >
              <T style={{ color: c.green, fontFamily: f.bold }}>
                {profile.name.slice(0, 1).toLocaleUpperCase()}
              </T>
            </Pressable>
          </View>
        </View>
        {saveError && (
          <View accessibilityRole="alert" style={s.errorBanner}>
            <T style={{ color: c.danger, flex: 1, fontSize: 12 }}>
              No se guardaron los últimos cambios. Conservá la app abierta y
              exportá un respaldo.
            </T>
            <Button variant="danger" onPress={retrySave}>
              Reintentar
            </Button>
          </View>
        )}
        {activeSession && page !== "workout" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate("workout")}
            style={s.activeBanner}
          >
            <View style={shared.row}>
              <Icon name="pause-circle" size={16} color={c.green} />
              <T style={{ color: c.green, fontFamily: f.bold, fontSize: 12 }}>
                {activeSession.routineName} en curso
              </T>
            </View>
            <T style={{ color: c.green, fontFamily: f.bold, fontSize: 12 }}>
              Continuar →
            </T>
          </Pressable>
        )}
        {assistantPage ? (
          <View
            key={profile.id}
            style={{
              flex: 1,
              minHeight: 0,
              paddingBottom: Math.max(5, inset.bottom),
            }}
          >
            <CompanionScreen
              navigate={navigate}
              onEffect={handleAssistantEffect}
            />
          </View>
        ) : (
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              s.scroll,
              {
                paddingHorizontal: desktop ? 38 : width < 360 ? 16 : 22,
                paddingTop: desktop ? 31 : 24,
                paddingBottom: 20,
              },
            ]}
          >
            <View
              key={profile.id}
              style={{ width: "100%", maxWidth: 920, alignSelf: "center" }}
            >
              {page === "routines" && <RoutinesScreen onStart={start} />}
              {page === "workout" && (
                <WorkoutScreen
                  onBack={() => navigate("home")}
                  onProgress={() => navigate("progress")}
                />
              )}
              {page === "meals" && (
                <MealsScreen onTargets={() => setProfileOpen(true)} />
              )}
              {page === "progress" && <ProgressScreen />}
              <View style={s.footer}>
                <Icon
                  name={
                    saveError
                      ? "alert-circle-outline"
                      : saving
                        ? "sync-outline"
                        : "checkmark-circle-outline"
                  }
                  size={12}
                  color={c.muted}
                />
                <T muted style={{ fontSize: 10 }}>
                  {saveLabel}
                </T>
                <T muted style={{ fontSize: 10 }}>
                  ·
                </T>
                <T muted style={{ fontSize: 10 }}>
                  Hecho a tu ritmo
                </T>
              </View>
            </View>
          </ScrollView>
        )}
        {!desktop && !assistantPage && (
          <View
            accessibilityRole="tablist"
            style={[s.bottomNav, { paddingBottom: Math.max(10, inset.bottom) }]}
          >
            {pages.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.id === currentPage }}
                onPress={() => navigate(item.id)}
                style={s.bottomItem}
              >
                <View
                  style={[
                    s.bottomIcon,
                    item.id === currentPage && { backgroundColor: c.greenSoft },
                  ]}
                >
                  <Icon
                    name={item.id === currentPage ? item.activeIcon : item.icon}
                    color={item.id === currentPage ? c.green : c.muted}
                    size={21}
                  />
                </View>
                <T
                  style={{
                    fontSize: 10,
                    fontFamily: item.id === currentPage ? f.bold : f.medium,
                    color: item.id === currentPage ? c.green : c.muted,
                  }}
                >
                  {item.label}
                </T>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ProfileSheet
        open={profileOpen}
        initialMode={profileMode}
        onClose={() => setProfileOpen(false)}
        onProfileChanged={() => navigate("home")}
      />
    </View>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, flexDirection: "row", backgroundColor: c.background },
  loading: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  sidebar: {
    width: 222,
    backgroundColor: "#FBFCF8",
    borderRightWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 18,
    paddingTop: 29,
    paddingBottom: 18,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 35,
    height: 39,
    borderRadius: 13,
    backgroundColor: c.green,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "-6deg" }],
  },
  wordmark: {
    fontFamily: f.display,
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -1.3,
  },
  sidebarLabel: {
    fontFamily: f.bold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: c.muted,
    marginTop: 16,
    marginLeft: 4,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    minHeight: 49,
    borderRadius: 13,
    gap: 12,
  },
  sidebarSelected: { backgroundColor: c.greenSoft },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 10,
    backgroundColor: "#7D9B73",
  },
  sidebarPet: { alignItems: "center", gap: 6, paddingBottom: 24 },
  sidebarProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 18,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#E6EBD8",
    alignItems: "center",
    justifyContent: "center",
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  scroll: { flexGrow: 1 },
  footer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    flexWrap: "wrap",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: c.paper,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 9,
    paddingHorizontal: 7,
  },
  bottomItem: { flex: 1, alignItems: "center", gap: 3, minHeight: 51 },
  bottomIcon: {
    borderRadius: 12,
    width: 46,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    backgroundColor: c.dangerSoft,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeBanner: {
    backgroundColor: c.greenSoft,
    paddingVertical: 11,
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
});
