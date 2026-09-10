import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { Icon } from "@/src/components/ui/Icon";
import { Button } from "@/src/components/ui/Button";
import { useSession } from "@/src/context/session";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const PRESETS = ["Peux-tu venir ?", "Appel important", "À table !", "Besoin de toi", "Silence svp"];

const KEY_SOUND = "stp.alarm.sound";
const KEY_VIB = "stp.alarm.vib";
const KEY_FLASH = "stp.alarm.flash";

export default function AlarmScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { code, devices, deviceId, deviceName, sendAlarm } = useSession();

  const [message, setMessage] = useState(PRESETS[0]);
  const [target, setTarget] = useState<string>("all");
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [flash, setFlash] = useState(true);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      setSound(await storage.getItem<boolean>(KEY_SOUND, true) ?? true);
      setVibrate(await storage.getItem<boolean>(KEY_VIB, true) ?? true);
      setFlash(await storage.getItem<boolean>(KEY_FLASH, true) ?? true);
    })();
  }, []);

  const toggle = (which: "sound" | "vibrate" | "flash") => {
    Haptics.selectionAsync().catch(() => {});
    if (which === "sound") {
      setSound((v) => {
        storage.setItem(KEY_SOUND, !v);
        return !v;
      });
    } else if (which === "vibrate") {
      setVibrate((v) => {
        storage.setItem(KEY_VIB, !v);
        return !v;
      });
    } else {
      setFlash((v) => {
        storage.setItem(KEY_FLASH, !v);
        return !v;
      });
    }
  };

  const others = devices.filter((d) => d.id !== deviceId);

  const fire = () => {
    if (!code) {
      router.push("/");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const ok = sendAlarm(target, { message: message || "Alerte", sender: deviceName, sound, vibrate, flash });
    if (ok) {
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>ALARME</Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
          <Icon name="cog" size={22} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sub}>
          Envoie une alerte discrète sur un autre téléphone posé près du PC — sans interrompre ton jeu.
        </Text>

        {/* Target chips */}
        <Text style={styles.section}>DESTINATAIRE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Tous" active={target === "all"} onPress={() => setTarget("all")} />
          {others.map((d) => (
            <Chip key={d.id} label={d.name} active={target === d.id} onPress={() => setTarget(d.id)} dim={!d.connected} />
          ))}
        </ScrollView>

        {/* Message presets */}
        <Text style={styles.section}>MESSAGE</Text>
        <View style={styles.presetWrap}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              testID={`preset-${p}`}
              onPress={() => setMessage(p)}
              style={[styles.preset, message === p && styles.presetActive]}
            >
              <Text style={[styles.presetTxt, message === p && styles.presetTxtActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          testID="custom-message-input"
          value={message}
          onChangeText={setMessage}
          placeholder="Message personnalisé…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {/* Config toggles */}
        <Text style={styles.section}>MODE D'ALERTE</Text>
        <View style={styles.toggleRow}>
          <Toggle icon="volume-high" label="Son" active={sound} onPress={() => toggle("sound")} testID="toggle-sound" />
          <Toggle icon="vibrate" label="Vibration" active={vibrate} onPress={() => toggle("vibrate")} testID="toggle-vibrate" />
          <Toggle icon="flash" label="Flash" active={flash} onPress={() => toggle("flash")} testID="toggle-flash" />
        </View>

        {/* CALL button */}
        <Pressable
          testID="call-button"
          onPress={fire}
          style={({ pressed }) => [styles.callBtn, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Icon name="bell-ring" size={48} color={colors.onError} />
          <Text style={styles.callTxt}>{sent ? "ALERTE ENVOYÉE" : "APPELER"}</Text>
        </Pressable>

        {!code ? (
          <Text style={styles.warn}>Créez une session sur l'accueil pour relier les téléphones.</Text>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Chip({ label, active, onPress, dim }: { label: string; active: boolean; onPress: () => void; dim?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable testID={`target-${label}`} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtActive, dim && !active && { opacity: 0.5 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Toggle({ icon, label, active, onPress, testID }: { icon: string; label: string; active: boolean; onPress: () => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Icon name={icon} size={24} color={active ? colors.onBrandPrimary : colors.muted} />
      <Text style={[styles.toggleTxt, { color: active ? colors.onBrandPrimary : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, letterSpacing: 0.5 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 20 },
  section: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 2, marginTop: 4 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 160,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onSurfaceTertiary },
  chipTxtActive: { color: colors.onBrandPrimary },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  presetTxt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onSurfaceSecondary },
  presetTxtActive: { color: colors.onBrandTertiary },
  input: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: {
    flex: 1,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  toggleTxt: { fontFamily: fonts.bodySemi, fontSize: 13 },
  callBtn: {
    marginTop: 8,
    height: 160,
    borderRadius: 20,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callTxt: { fontFamily: fonts.display, fontSize: 32, color: colors.onError, letterSpacing: 2 },
  warn: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.warning, textAlign: "center" },
}));
