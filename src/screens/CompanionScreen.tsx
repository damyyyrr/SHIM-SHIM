import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useApp } from '../data/AppContext';
import { id } from '../domain/types';
import { companionReply } from '../domain/companion';
import { Badge, Card, Heading, Icon, Meter, shared, T } from '../ui/components';
import { Pet } from '../ui/Pet';
import { colors as c, fonts as f } from '../ui/theme';

export function CompanionScreen() {
  const { state, profile, addMessages } = useApp();
  const [draft, setDraft] = useState('');
  const messages = state.messages.filter((message) => message.profileId === profile.id);
  const count = state.sessions.filter(
    (session) => session.profileId === profile.id && !session.sample,
  ).length;
  const xp = count * 30,
    level = Math.floor(xp / 100) + 1;
  function send(message = draft) {
    if (!message.trim()) return;
    const text = message.trim().slice(0, 1000);
    addMessages([
      { id: id(), profileId: profile.id, role: 'user', text },
      {
        id: id(),
        profileId: profile.id,
        role: 'assistant',
        text: companionReply(text, state, profile),
      },
    ]);
    setDraft('');
    Keyboard.dismiss();
  }
  return (
    <View style={shared.page}>
      <Heading
        eyebrow="Tu compañero de camino"
        subtitle="Para celebrar, entender y volver a intentarlo."
      >
        Con Mimo,{'\n'}a tu ritmo.
      </Heading>
      <View style={s.room}>
        <Badge background="#FFFFFFB8" color={c.lilacInk} icon="sparkles-outline">
          MIMO · NIVEL {level}
        </Badge>
        <View style={s.circle} />
        <Pet size={180} mood={count ? 'celebrate' : 'happy'} />
        <T style={s.roomTitle}>
          {count ? 'Mirá todo lo que venimos sumando.' : 'Tenemos un lindo camino por delante.'}
        </T>
        <View style={{ width: '100%', maxWidth: 340, gap: 7 }}>
          <View style={shared.between}>
            <T style={{ fontSize: 11, color: c.lilacInk }}>Crecemos con tus sesiones</T>
            <T style={{ fontFamily: f.bold, fontSize: 11, color: c.lilacInk }}>
              {xp % 100} / 100 XP
            </T>
          </View>
          <Meter
            value={xp % 100}
            target={100}
            color={c.lilacInk}
            label="Experiencia de Mimo para el próximo nivel"
          />
        </View>
        <T style={{ fontSize: 10, color: c.lilacInk }}>
          +30 XP por sesión propia. Descansar no te quita puntos.
        </T>
      </View>
      <Card style={{ gap: 16 }}>
        <View style={shared.between}>
          <View style={shared.row}>
            <View style={s.dot} />
            <T style={{ fontFamily: f.rounded, fontSize: 18 }}>Un ratito con Mimo</T>
          </View>
          <Badge background={c.background} color={c.muted}>
            Modo local
          </Badge>
        </View>
        <T style={shared.helper}>
          Respuestas guiadas con tus registros. Todavía no hay una IA conectada.
        </T>
        <View style={{ gap: 12 }}>
          <View style={s.bubble}>
            <T>
              ¡Hola! Me alegra tenerte por acá. Podemos revisar tu próximo entrenamiento, tus
              comidas o simplemente bajar un cambio. 🌿
            </T>
          </View>
          {messages.slice(-12).map((message) => (
            <View key={message.id} style={[s.bubble, message.role === 'user' && s.userBubble]}>
              <T style={{ color: message.role === 'user' ? c.paper : c.ink }}>{message.text}</T>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {['¿Cuál es mi próxima carga?', '¿Qué comí hoy?', 'Hoy necesito descansar'].map(
            (question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                onPress={() => send(question)}
                style={s.prompt}
              >
                <T style={{ fontSize: 12, color: c.green, flex: 1 }}>{question}</T>
                <Icon name="arrow-forward" size={15} color={c.green} />
              </Pressable>
            ),
          )}
        </View>
        <View style={s.composer}>
          <TextInput
            accessibilityLabel="Mensaje para Mimo"
            placeholder="Contame cómo venís…"
            placeholderTextColor={c.muted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            maxLength={1000}
            style={s.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={() => send()}
            style={[s.send, !draft.trim() && { opacity: 0.4 }]}
          >
            <Icon name="arrow-up" color={c.paper} size={21} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}
const s = StyleSheet.create({
  room: {
    backgroundColor: c.lilacSoft,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    width: 185,
    height: 185,
    top: 72,
    borderRadius: 100,
    backgroundColor: '#F7F2FD',
  },
  roomTitle: {
    fontFamily: f.rounded,
    fontSize: 19,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  dot: { width: 7, height: 7, borderRadius: 10, backgroundColor: c.green },
  bubble: {
    backgroundColor: c.greenPale,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 15,
    alignSelf: 'flex-start',
    maxWidth: '94%',
  },
  userBubble: {
    backgroundColor: c.green,
    alignSelf: 'flex-end',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  prompt: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 7,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 17,
  },
  input: {
    flex: 1,
    fontFamily: f.body,
    fontSize: 16,
    color: c.ink,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.green,
  },
});
