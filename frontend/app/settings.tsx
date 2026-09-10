import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { Icon } from "@/src/components/ui/Icon";
import { Button } from "@/src/components/ui/Button";
import { useSession } from "@/src/context/session";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const KEY_SOUND = "stp.alarm.sound";
const KEY_VIB = "stp.alarm.vib";
const KEY_FLASH = "stp.alarm.flash";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { deviceName, setDeviceName, code, leave } = useSession();

  const [name, setName] = useState(deviceName);
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [flash, setFlash] = useState(true);

  useEffect(() => setName(deviceName), [deviceName]);
  useEffect(() => {
    (async () => {
      setSound((await storage.getItem<boolean>(KEY_SOUND, true)) ?? true);
      setVibrate((await storage.getItem<boolean>(KEY_VIB, true)) ?? true);
      setFlash((await storage.getItem<boolean>(KEY_FLASH, true)) ?? true);
    })();
  }, []);

  const saveName = () => {
    Haptics.selectionAsync().catch(() => {});
    if (name.trim()) setDeviceName(name.trim());
  };

  const row = (
    key: string,
    label: string,
    icon: string,
    value: boolean,
    setValue: (v: boolean) => void,
    testID: string,
  ) => (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        const nv = !value;
        setValue(nv);
        storage.setItem(key, nv);
      }}
      style={styles.settingRow}
    >
      <Icon name={icon} size={22} color={colors.onSurfaceSecondary} />
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>RÉGLAGES</Text>
        <Pressable testID="settings-close" onPress={() => router.back()} hitSlop={12}>
          <Icon name="close" size={24} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.section}>NOM DE L'APPAREIL</Text>
          <View style={styles.nameRow}>
            <TextInput
              testID="device-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Nom de la caméra"
              placeholderTextColor={colors.muted}
              style={styles.input}
              onBlur={saveName}
            />
            <Button label="OK" onPress={saveName} variant="secondary" testID="save-name-button" />
          </View>
        </View>

        <View>
          <Text style={styles.section}>ALARME PAR DÉFAUT</Text>
          <View style={styles.card}>
            {row(KEY_SOUND, "Son", "volume-high", sound, setSound, "set-sound")}
            <View style={styles.divider} />
            {row(KEY_VIB, "Vibration", "vibrate", vibrate, setVibrate, "set-vibrate")}
            <View style={styles.divider} />
            {row(KEY_FLASH, "Flash écran", "flash", flash, setFlash, "set-flash")}
          </View>
        </View>

        <View>
          <Text style={styles.section}>À PROPOS</Text>
          <View style={styles.card}>
            <Text style={styles.about}>
              StudioTally Pro relie vos téléphones via un code de session. Le tally et l'alarme
              fonctionnent en autonomie (sans OBS). Le mode OBS se connecte directement à votre PC
              sur le même réseau WiFi via OBS WebSocket.
            </Text>
            <Text style={[styles.about, { color: colors.warning }]}>
              Le flux vidéo live d'un téléphone vers OBS nécessite un build natif et ne fonctionne
              pas dans Expo Go.
            </Text>
          </View>
        </View>

        {code ? (
          <Button label="Quitter la session" icon="logout" variant="ghost" onPress={() => { leave(); router.back(); }} testID="settings-leave-button" />
        ) : null}
      </KeyboardAwareScrollView>
    </View>
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
  section: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 2, marginBottom: 10 },
  nameRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
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
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 14, height: 58 },
  settingLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.onSurface },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: colors.brandPrimary },
  knob: { width: 24, height: 24, borderRadius: 999, backgroundColor: colors.muted },
  knobOn: { backgroundColor: colors.onBrandPrimary, alignSelf: "flex-end" },
  divider: { height: 1, backgroundColor: colors.divider },
  about: { fontFamily: fonts.body, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 20, paddingVertical: 10 },
}));
