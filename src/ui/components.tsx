import React, { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors as c, fonts as f } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({
  name,
  size = 20,
  color = c.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <Ionicons name={name} size={size} color={color} />;
export function T({
  children,
  style,
  muted,
  ...props
}: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  return (
    <Text {...props} style={[styles.text, muted && { color: c.muted }, style]}>
      {children}
    </Text>
  );
}
export function Heading({
  children,
  eyebrow,
  subtitle,
  right,
}: {
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.heading}>
      <View style={{ flex: 1, gap: 6 }}>
        {eyebrow && <T style={styles.eyebrow}>{eyebrow}</T>}
        <T accessibilityRole="header" style={styles.title}>
          {children}
        </T>
        {subtitle && <T muted>{subtitle}</T>}
      </View>
      {right}
    </View>
  );
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Badge({
  children,
  color = c.green,
  background = c.greenSoft,
  icon,
}: {
  children: ReactNode;
  color?: string;
  background?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {icon && <Icon name={icon} size={13} color={color} />}
      <T style={{ color, fontFamily: f.bold, fontSize: 11 }}>{children}</T>
    </View>
  );
}
export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  loading,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const foreground = variant === 'primary' ? c.paper : variant === 'danger' ? c.danger : c.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: c.green }
          : variant === 'secondary'
            ? { backgroundColor: c.greenSoft }
            : variant === 'danger'
              ? { backgroundColor: c.dangerSoft }
              : { backgroundColor: 'transparent' },
        pressed && { opacity: 0.78, transform: [{ scale: 0.99 }] },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon && <Icon name={icon} color={foreground} size={18} />}
          <T style={{ fontFamily: f.bold, color: foreground, textAlign: 'center' }}>{children}</T>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.greenSoft }]}
    >
      <Icon name={icon} color={danger ? c.danger : c.muted} size={20} />
    </Pressable>
  );
}
export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      {label && <T style={styles.fieldLabel}>{label}</T>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 88, textAlignVertical: 'top' },
          style,
        ]}
      />
      {hint && (
        <T muted style={{ fontSize: 11 }}>
          {hint}
        </T>
      )}
    </View>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1000,
  integer = false,
  style,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const parsed = Number(draft.replace(',', '.'));
    if (
      !draft.trim() ||
      !Number.isFinite(parsed) ||
      parsed < min ||
      parsed > max ||
      (integer && !Number.isInteger(parsed))
    ) {
      setDraft(String(value));
      return;
    }
    onChange(parsed);
  }
  function change(text: string) {
    setDraft(text);
    const parsed = Number(text.replace(',', '.'));
    if (
      text.trim() &&
      Number.isFinite(parsed) &&
      parsed >= min &&
      parsed <= max &&
      (!integer || Number.isInteger(parsed))
    )
      onChange(parsed);
  }
  return (
    <View style={[{ flex: 1 }, style]}>
      <Field
        label={label}
        value={draft}
        onChangeText={change}
        onBlur={commit}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        inputMode={integer ? 'numeric' : 'decimal'}
        selectTextOnFocus
        onSubmitEditing={commit}
      />
    </View>
  );
}
export function SectionTitle({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <T accessibilityRole="header" style={styles.sectionText}>
        {children}
      </T>
      {action && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <T style={{ color: c.green, fontFamily: f.bold, fontSize: 12 }}>{action} →</T>
        </Pressable>
      )}
    </View>
  );
}
export function Empty({
  icon,
  title,
  detail,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} color={c.green} size={26} />
      </View>
      <T style={styles.sectionText}>{title}</T>
      <T muted style={{ textAlign: 'center', maxWidth: 320 }}>
        {detail}
      </T>
      {action && onAction && (
        <Button onPress={onAction} variant="secondary">
          {action}
        </Button>
      )}
    </View>
  );
}
export function Sheet({
  visible,
  title,
  children,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Cerrar ventana"
          accessibilityRole="button"
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <T accessibilityRole="header" style={[styles.sectionText, { flex: 1 }]}>
              {title}
            </T>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
          >
            {children}
          </ScrollView>
          {footer && <View style={styles.sheetFooter}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}
export function Confirm({
  visible,
  title,
  detail,
  onConfirm,
  onClose,
  confirmLabel = 'Eliminar',
}: {
  visible: boolean;
  title: string;
  detail: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <T muted>{detail}</T>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Button onPress={onClose} variant="secondary" style={{ flex: 1 }}>
          Cancelar
        </Button>
        <Button onPress={onConfirm} variant="danger" style={{ flex: 1 }}>
          {confirmLabel}
        </Button>
      </View>
    </Sheet>
  );
}
export function Meter({
  value,
  target,
  color = c.green,
  label,
}: {
  value: number;
  target: number;
  color?: string;
  label: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.max(target, value, 1), now: value }}
      style={{ height: 7, borderRadius: 6, backgroundColor: c.greenPale, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0}%`,
          backgroundColor: color,
          height: 7,
          borderRadius: 6,
        }}
      />
    </View>
  );
}
export const shared = StyleSheet.create({
  page: { gap: 22, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontFamily: f.display, fontSize: 23, color: c.ink, letterSpacing: -0.5 },
  rule: { height: 1, backgroundColor: c.border },
  helper: { fontSize: 12, lineHeight: 18, color: c.muted },
  label: { fontFamily: f.bold, fontSize: 12, color: c.muted },
  error: { color: c.danger, fontSize: 13 },
});
const styles = StyleSheet.create({
  text: { fontFamily: f.body, fontSize: 14, color: c.ink, lineHeight: 21 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: {
    fontFamily: f.bold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: c.muted,
  },
  title: { fontFamily: f.display, fontSize: 36, lineHeight: 41, letterSpacing: -1.25 },
  card: {
    backgroundColor: c.paper,
    borderRadius: 23,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  button: {
    borderRadius: 15,
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  fieldLabel: { fontFamily: f.medium, fontSize: 12, color: c.muted },
  input: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 46,
    color: c.ink,
    fontFamily: f.medium,
    fontSize: 16,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionText: { fontFamily: f.rounded, fontSize: 19, letterSpacing: -0.35 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 12 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: c.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: '#20392E66',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: c.paper,
    borderRadius: 26,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#183022',
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },
  sheetHeader: {
    paddingVertical: 12,
    paddingLeft: 22,
    paddingRight: 10,
    borderBottomWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  sheetContent: { padding: 22, gap: 16 },
  sheetFooter: { padding: 18, borderTopWidth: 1, borderColor: c.border },
});
