import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useApp } from "../data/AppContext";
import { ChatMessage, goalLabel, id } from "../domain/types";
import { askAssistant, connectionStatus } from "../assistant/client";
import {
  AssistantAction,
  ClientEffect,
  ConnectionStatus,
} from "../assistant/types";
import { ActionCard } from "../assistant/ActionCard";
import { ConnectionSheet } from "../assistant/ConnectionSheet";
import { Badge, Icon, shared, T } from "../ui/components";
import { Pet } from "../ui/Pet";
import { colors as c, fonts as f } from "../ui/theme";
import { Destination } from "./HomeScreen";

const prompts = [
  {
    icon: "trending-up-outline" as const,
    title: "¿Cuándo subo el peso?",
    detail: "Revisemos mi rutina y mi historial",
    text: "En base a mi rutina y a mi historial, ¿cuándo aproximadamente debería aumentar el peso en mis ejercicios? Explicame qué me falta y qué es solo una estimación.",
  },
  {
    icon: "barbell-outline" as const,
    title: "Entrenemos juntos",
    detail: "Guiame y registrá mis series",
    text: "Quiero entrenar. Revisá mis rutinas y ayudame a empezar la sesión y registrar las series por acá.",
  },
  {
    icon: "create-outline" as const,
    title: "Ajustemos mi plan",
    detail: "Contame qué necesitás cambiar",
    text: "Quiero ajustar mi rutina. Mirá mi plan actual y preguntame qué quiero cambiar antes de modificarlo.",
  },
];
function AssistantText({ text }: { text: string }) {
  return (
    <View style={{ gap: 10 }}>
      {text
        .replace(/^#{1,6}\s+/gm, "")
        .split(/\n\n+/)
        .map((paragraph, i) => (
          <T key={i} selectable style={{ fontSize: 15, lineHeight: 24 }}>
            {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <T key={j} style={{ fontSize: 15, fontFamily: f.bold }}>
                  {part.slice(2, -2)}
                </T>
              ) : (
                part
              ),
            )}
          </T>
        ))}
    </View>
  );
}
export function CompanionScreen({
  navigate,
  onEffect,
}: {
  navigate: (page: Destination) => void;
  onEffect: (effect: ClientEffect) => Promise<void>;
}) {
  const { state, profile, addMessages, commitAssistantTurn } = useApp();
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [connectionOpen, setConnectionOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null),
    [elapsed, setElapsed] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { width } = useWindowDimensions();
  const messages = state.messages.filter((m) => m.profileId === profile.id);
  useEffect(() => {
    let active = true;
    void connectionStatus(state).then((value) => {
      if (active) setStatus(value);
    });
    return () => {
      active = false;
    };
  }, [state.assistantServerUrl]);
  useEffect(() => () => controller.current?.abort(), [profile.id]);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (messages.length || busy)
      scroll.current?.scrollToEnd({ animated: true });
  }, [messages.length, busy]);
  async function send(message = draft) {
    if (!message.trim() || controller.current) return;
    const user: ChatMessage = {
      id: id(),
      profileId: profile.id,
      role: "user",
      text: message.trim().slice(0, 6000),
    };
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setElapsed(0);
    setDraft("");
    addMessages([user]);
    try {
      const response = await askAssistant(
        state,
        [...state.messages, user],
        abort.signal,
      );
      if (abort.signal.aborted) return;
      commitAssistantTurn(response, user.profileId);
      setStatus((current) => ({
        connected: true,
        provider: current?.provider,
        model: response.model,
        models: current?.models ?? [response.model],
        message: "Mimo está conectado.",
      }));
      for (const action of response.actions)
        if (action.effect) await onEffect(action.effect);
    } catch (error) {
      if (!abort.signal.aborted)
        addMessages([
          {
            id: id(),
            profileId: user.profileId,
            role: "assistant",
            text:
              error instanceof Error
                ? error.message
                : "No pude completar la consulta. No apliqué cambios.",
          },
        ]);
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  function stop() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    addMessages([
      {
        id: id(),
        profileId: profile.id,
        role: "assistant",
        text: "Detuve la consulta. No apliqué cambios de este turno.",
      },
    ]);
  }
  const compact = width < 500;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, minHeight: 0 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.rail, { paddingHorizontal: compact ? 20 : 38 }]}>
        <View style={[shared.row, { flex: 1, minWidth: 0 }]}>
          <View
            style={[
              s.dot,
              { backgroundColor: status?.connected ? "#71956B" : "#B3A480" },
            ]}
          />
          <T style={{ fontFamily: f.medium, fontSize: 12 }}>Mimo</T>
          <T muted numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
            {status?.connected
              ? status.provider === "ollama"
                ? "· Modelo local conectado"
                : "· IA online conectada"
              : status
                ? "· Revisar conexión"
                : "· Conectando…"}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar conexión de Mimo"
          onPress={() => setConnectionOpen(true)}
          style={s.connection}
        >
          <Icon name="options-outline" size={18} color={c.muted} />
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: compact ? 19 : 38,
          paddingBottom: 20,
        }}
      >
        <View style={s.conversation}>
          {!messages.length && (
            <View style={s.welcome}>
              <View style={s.intro}>
                <View style={{ flex: 1, gap: 12 }}>
                  <Badge icon="sparkles-outline">
                    TU PLAN, EN UNA CONVERSACIÓN
                  </Badge>
                  <T
                    accessibilityRole="header"
                    style={[
                      s.title,
                      compact && { fontSize: 33, lineHeight: 38 },
                    ]}
                  >
                    Decímelo.{"\n"}Lo hacemos juntos.
                  </T>
                </View>
                <View style={s.welcomePet}>
                  <Pet size={compact ? 92 : 132} />
                </View>
              </View>
              <T style={s.introCopy}>
                Cambiar tu rutina, registrar una serie o entender tu próximo
                paso. Pedímelo como se lo contarías a alguien de tu equipo.
              </T>
              <View
                style={[shared.row, { gap: 7, flexWrap: "wrap", marginTop: 3 }]}
              >
                <Badge background={c.lilacSoft} color={c.lilacInk}>
                  {goalLabel(profile.goal)}
                </Badge>
                <T muted style={{ fontSize: 11 }}>
                  {
                    state.routines.filter((r) => r.profileId === profile.id)
                      .length
                  }{" "}
                  rutinas en tu plan
                </T>
              </View>
              <View style={{ gap: 9, marginTop: 16 }}>
                {prompts.map((prompt) => (
                  <Pressable
                    key={prompt.title}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      void send(prompt.text);
                    }}
                    style={({ pressed }) => [
                      s.prompt,
                      pressed && { backgroundColor: c.greenSoft },
                    ]}
                  >
                    <View style={s.promptIcon}>
                      <Icon name={prompt.icon} size={21} color={c.green} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T style={{ fontFamily: f.bold, fontSize: 14 }}>
                        {prompt.title}
                      </T>
                      <T muted style={{ fontSize: 11 }}>
                        {prompt.detail}
                      </T>
                    </View>
                    <Icon name="arrow-up-outline" size={17} color={c.green} />
                  </Pressable>
                ))}
              </View>
              {status && !status.connected && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConnectionOpen(true)}
                  style={s.setup}
                >
                  <Icon name="cloud-outline" color={c.lilacInk} size={18} />
                  <T style={{ fontSize: 12, color: c.lilacInk, flex: 1 }}>
                    Revisemos la conexión de Mimo.
                  </T>
                  <Icon name="arrow-forward" size={15} color={c.lilacInk} />
                </Pressable>
              )}
            </View>
          )}
          {messages.map((message) => (
            <View
              key={message.id}
              style={[s.message, message.role === "user" && s.userMessage]}
            >
              {message.role === "assistant" && (
                <View style={[shared.row, { gap: 6, marginBottom: 7 }]}>
                  <Icon name="sparkles-outline" size={13} color={c.green} />
                  <T
                    style={{ fontFamily: f.bold, fontSize: 11, color: c.green }}
                  >
                    Mimo
                  </T>
                </View>
              )}
              {message.role === "assistant" ? (
                <AssistantText text={message.text} />
              ) : (
                <T
                  selectable
                  style={{ fontSize: 15, lineHeight: 24, color: c.paper }}
                >
                  {message.text}
                </T>
              )}
              {!!message.actions?.length && (
                <View style={{ gap: 10, marginTop: 15 }}>
                  {message.actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      messageId={message.id}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
          {busy && (
            <View accessibilityLiveRegion="polite" style={s.thinking}>
              <ActivityIndicator size="small" color={c.green} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 13, fontFamily: f.medium }}>
                  {elapsed < 20
                    ? "Mimo está revisando tu pedido…"
                    : "Sigo trabajando con tu plan…"}
                </T>
                <T muted style={{ fontSize: 11 }}>
                  {elapsed > 15
                    ? `${elapsed} s · Podés detener la consulta cuando quieras.`
                    : "Consultando tu plan y las herramientas de la app."}
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={stop}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T style={{ color: c.green, fontFamily: f.bold, fontSize: 12 }}>
                  Detener
                </T>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      <View style={[s.composerArea, { paddingHorizontal: compact ? 15 : 38 }]}>
        <View
          style={{ width: "100%", maxWidth: 790, alignSelf: "center", gap: 9 }}
        >
          <View style={s.composer}>
            <TextInput
              ref={input}
              accessibilityLabel="Mensaje para Mimo"
              placeholder={
                messages.length
                  ? "Seguimos por acá…"
                  : "Mimo, quiero cambiar mi rutina…"
              }
              placeholderTextColor={c.muted}
              value={draft}
              onChangeText={setDraft}
              multiline
              submitBehavior="submit"
              onSubmitEditing={() => {
                void send();
              }}
              maxLength={6000}
              style={s.input}
              editable={!busy}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? "Detener respuesta" : "Enviar mensaje"}
              disabled={!busy && !draft.trim()}
              onPress={() => (busy ? stop() : void send())}
              style={[s.send, !busy && !draft.trim() && { opacity: 0.4 }]}
            >
              <Icon
                name={busy ? "stop" : "arrow-up"}
                color={c.paper}
                size={20}
              />
            </Pressable>
          </View>
          <View style={s.shortcuts}>
            {[
              {
                label: "Mi plan",
                icon: "barbell-outline" as const,
                page: "routines" as const,
              },
              {
                label: "Comidas",
                icon: "restaurant-outline" as const,
                page: "meals" as const,
              },
              {
                label: "Historial",
                icon: "stats-chart-outline" as const,
                page: "progress" as const,
              },
            ].map((item) => (
              <Pressable
                key={item.page}
                accessibilityRole="button"
                onPress={() => navigate(item.page)}
                style={s.shortcut}
              >
                <Icon name={item.icon} size={14} color={c.muted} />
                <T muted style={{ fontSize: 11 }}>
                  {item.label}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <ConnectionSheet
        open={connectionOpen}
        onClose={() => setConnectionOpen(false)}
        onStatus={setStatus}
      />
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  rail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    gap: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 10 },
  connection: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  conversation: {
    width: "100%",
    maxWidth: 790,
    alignSelf: "center",
    flexGrow: 1,
    gap: 22,
    paddingTop: 17,
  },
  welcome: { gap: 17, paddingTop: 10, paddingBottom: 12 },
  intro: { flexDirection: "row", alignItems: "center", gap: 0 },
  welcomePet: { marginLeft: -9, marginRight: -4 },
  title: {
    fontFamily: f.display,
    fontSize: 42,
    lineHeight: 47,
    letterSpacing: -1.3,
    color: c.ink,
  },
  introCopy: { fontSize: 14, lineHeight: 23, color: c.muted, maxWidth: 570 },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "#FCFDF9",
    minHeight: 77,
  },
  promptIcon: {
    backgroundColor: c.greenSoft,
    width: 41,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  setup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 14,
    borderRadius: 15,
    backgroundColor: c.lilacSoft,
  },
  message: {
    maxWidth: "100%",
    alignSelf: "flex-start",
    width: "100%",
    paddingVertical: 5,
  },
  userMessage: {
    alignSelf: "flex-end",
    width: "auto",
    maxWidth: "91%",
    borderRadius: 21,
    borderBottomRightRadius: 5,
    padding: 16,
    backgroundColor: c.green,
  },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  composerArea: {
    paddingTop: 12,
    paddingBottom: 7,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    padding: 8,
    paddingLeft: 14,
    backgroundColor: c.paper,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#C7D4C6",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    fontFamily: f.body,
    fontSize: 16,
    lineHeight: 23,
    color: c.ink,
    paddingVertical: 10,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: c.green,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcuts: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 35,
  },
});
