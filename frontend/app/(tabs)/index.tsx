import { useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { useSession } from "@/src/context/session";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1783980643230-69c54b9996a2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBicm9hZGNhc3QlMjBzdHVkaW8lMjBkYXJrfGVufDB8fHx8MTc4OTA3MTgxOHww&ixlib=rb-4.1.0&q=85";

const MODES = [
  { key: "tally", label: "MON TALLY", sub: "Voyant plein écran", icon: "lightbulb-on", route: "/tally?mode=session" },
  { key: "camera", label: "MA CAMÉRA", sub: "Moniteur + tally", icon: "camera", route: "/camera" },
  { key: "studio", label: "RÉGIE", sub: "Piloter les caméras", icon: "view-grid", route: "/studio" },
  { key: "alarm", label: "ALARME", sub: "Appeler discrètement", icon: "bell-ring", route: "/alarm" },
] as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { code, status, devices, deviceName, startSession, connect, leave } = useSession();

  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const online = devices.filter((d) => d.connected).length;

  const handleCreate = async () => {
    setBusy(true);
    setErr(null);
    try {
      await startSession("Studio");
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim().length < 3) return;
    setBusy(true);
    setErr(null);
    try {
      await connect(joinCode.trim());
      setJoinCode("");
    } catch (e: any) {
      setErr(e?.message || "Session introuvable");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    if (!code) return;
    Share.share({ message: `Rejoins ma session StudioTally Pro avec le code : ${code}` });
  };

  const go = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.brand}>STUDIOTALLY</Text>
          <Text style={styles.brandSub}>PRO</Text>
        </View>
        <Pressable testID="settings-button" onPress={() => router.push("/settings")} hitSlop={12} style={styles.gear}>
          <Icon name="cog" size={24} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Session card */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" transition={300} />
          <LinearGradient
            colors={["rgba(10,10,10,0.35)", "rgba(10,10,10,0.95)"]}
            style={styles.heroScrim}
          />
          <View style={styles.heroContent}>
            {code ? (
              <>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: status === "connected" ? colors.success : colors.warning },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {status === "connected" ? "SESSION ACTIVE" : "RECONNEXION…"}
                  </Text>
                </View>
                <Text style={styles.codeLabel}>CODE DE SESSION</Text>
                <Text testID="session-code" style={styles.code}>
                  {code}
                </Text>
                <Text style={styles.deviceCount}>
                  {online} appareil{online > 1 ? "s" : ""} en ligne · Vous : {deviceName}
                </Text>
                <View style={styles.heroBtns}>
                  <Button label="Partager" icon="share-variant" variant="secondary" onPress={handleShare} style={{ flex: 1 }} testID="share-button" />
                  <Button label="Quitter" icon="logout" variant="ghost" onPress={leave} style={{ flex: 1 }} testID="leave-button" />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.codeLabel}>AUCUNE SESSION</Text>
                <Text style={styles.heroTitle}>Reliez vos téléphones</Text>
                <Text style={styles.heroDesc}>
                  Créez une session puis rejoignez-la depuis vos autres téléphones avec le même code.
                </Text>
                <Button
                  label="Créer une session"
                  icon="plus-circle"
                  onPress={handleCreate}
                  loading={busy}
                  testID="create-session-button"
                />
                <View style={styles.joinRow}>
                  <TextInput
                    testID="join-code-input"
                    value={joinCode}
                    onChangeText={(t) => setJoinCode(t.toUpperCase())}
                    placeholder="CODE"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={5}
                    style={styles.joinInput}
                  />
                  <Button label="Rejoindre" onPress={handleJoin} loading={busy} variant="secondary" testID="join-button" style={{ flex: 1 }} />
                </View>
                {err ? <Text style={styles.err}>{err}</Text> : null}
              </>
            )}
          </View>
        </View>

        {/* Mode grid */}
        <Text style={styles.sectionTitle}>MODES</Text>
        <View style={styles.grid}>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              testID={`mode-${m.key}`}
              onPress={() => go(m.route)}
              style={({ pressed }) => [styles.block, pressed && styles.blockPressed]}
            >
              <Icon name={m.icon} size={30} color={colors.brandPrimary} />
              <Text style={styles.blockLabel}>{m.label}</Text>
              <Text style={styles.blockSub}>{m.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, letterSpacing: 1, lineHeight: 26 },
  brandSub: { fontFamily: fonts.display, fontSize: 14, color: colors.brandPrimary, letterSpacing: 4 },
  gear: { padding: 6 },
  hero: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "flex-end",
  },
  heroImg: { ...({ position: "absolute" } as const), top: 0, left: 0, right: 0, bottom: 0 },
  heroScrim: { ...({ position: "absolute" } as const), top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { padding: 18, gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  statusText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.onSurface, letterSpacing: 1 },
  codeLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted, letterSpacing: 2 },
  code: { fontFamily: fonts.display, fontSize: 64, color: colors.brandPrimary, letterSpacing: 6, lineHeight: 64 },
  deviceCount: { fontFamily: fonts.body, fontSize: 13, color: colors.onSurfaceSecondary },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  heroTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.onSurface, lineHeight: 36 },
  heroDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.onSurfaceSecondary, marginBottom: 4 },
  joinRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  joinInput: {
    width: 110,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 3,
    textAlign: "center",
  },
  err: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 13 },
  sectionTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 2, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  block: {
    width: "47.8%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    minHeight: 120,
    justifyContent: "center",
  },
  blockPressed: { opacity: 0.7, borderColor: colors.brandPrimary },
  blockLabel: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface, letterSpacing: 0.5 },
  blockSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
}));
