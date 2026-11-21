import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useApp } from "../data/AppContext";
import { ConnectionStatus } from "./types";
import { apiBase, connectionStatus } from "./client";
import { Badge, Button, Field, Sheet, shared, T } from "../ui/components";

export function ConnectionSheet({
  open,
  onClose,
  onStatus,
}: {
  open: boolean;
  onClose: () => void;
  onStatus: (status: ConnectionStatus) => void;
}) {
  const { state, setAssistantServerUrl } = useApp();
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false),
    [status, setStatus] = useState<ConnectionStatus | null>(null);
  useEffect(() => {
    if (open) {
      setUrl(state.assistantServerUrl ?? "");
      setError("");
    }
  }, [open]);
  async function check() {
    const normalized = url.trim().replace(/\/$/, "");
    if (normalized) {
      try {
        const parsed = new URL(normalized);
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password ||
          parsed.pathname !== "/"
        )
          throw new Error();
      } catch {
        setError(
          "Usá una dirección completa del servidor, por ejemplo http://192.168.1.7:8082.",
        );
        return;
      }
    }
    setChecking(true);
    setError("");
    const result = await connectionStatus({
      ...state,
      assistantServerUrl: normalized,
    });
    setStatus(result);
    onStatus(result);
    setAssistantServerUrl(normalized);
    setChecking(false);
  }
  return (
    <Sheet visible={open} title="La conexión de Mimo" onClose={onClose}>
      <Badge icon="cloud-outline">Mimo · IA online</Badge>
      <T>
        El servidor conecta tu conversación con Groq. Para responder, el
        proveedor recibe tus mensajes y el contexto necesario del perfil actual.
        La clave queda guardada en el servidor.
      </T>
      <Field
        label="Servidor de Mimo"
        value={url}
        onChangeText={setUrl}
        placeholder={
          Platform.OS === "web"
            ? "Automático: el mismo servidor de esta app"
            : "http://192.168.1.7:8082"
        }
        autoCapitalize="none"
        autoCorrect={false}
      />
      <T style={shared.helper}>
        {Platform.OS === "web"
          ? "Dejá vacío para usar la conexión segura de esta app."
          : "Usá la dirección HTTPS del servidor alojado."}{" "}
        La clave del proveedor no se ingresa en el celular.
      </T>
      <Button
        icon="refresh"
        loading={checking}
        onPress={() => {
          void check();
        }}
      >
        Comprobar conexión
      </Button>
      {status && (
        <View style={{ gap: 6 }}>
          <T style={{ fontWeight: "600" }}>
            {status.connected
              ? "Mimo está listo para conversar."
              : "La conexión necesita atención."}
          </T>
          <T muted>{status.message}</T>
          <T style={shared.helper}>Modelo: {status.model}</T>
          {status.models.length > 0 && (
            <T style={shared.helper}>Disponibles: {status.models.join(", ")}</T>
          )}
        </View>
      )}
      {!!error && (
        <T accessibilityRole="alert" style={shared.error}>
          {error}
        </T>
      )}
      <T style={shared.helper}>
        La API tiene una cuota gratuita. Si llegamos al límite, Mimo te avisa;
        no cambiamos automáticamente a un plan pago.
      </T>
    </Sheet>
  );
}
