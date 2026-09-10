import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { useSession } from "@/src/context/session";
import { Device, DeviceState } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { code, devices, setState, blackout, deviceId } = useSession();

  const setLive = (d: Device) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setState(d.id, d.state === "live" ? "idle" : "live");
  };
  const setPreview = (d: Device) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState(d.id, d.state === "preview" ? "idle" : "preview");
  };

  const borderFor = (s: DeviceState) =>
    s === "live" ? colors.error : s === "preview" ? colors.success : colors.border;

  if (!code) {
    return (
      <View style={styles.container}>
        <Header insets={insets} code={code} />
        <View style={styles.empty}>
          <Icon name="video-off" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Aucune session</Text>
          <Text style={styles.emptyDesc}>Créez ou rejoignez une session pour piloter vos caméras.</Text>
          <Button label="Aller à l'accueil" icon="home" onPress={() => router.push("/")} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header insets={insets} code={code} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        {devices.length === 0 ? (
          <View style={styles.dashed}>
            <Icon name="cellphone-link" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>En attente de caméras…</Text>
            <Text style={styles.emptyDesc}>Partagez le code {code} pour connecter d'autres téléphones.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {devices.map((d) => (
              <View key={d.id} style={[styles.tile, { borderColor: borderFor(d.state) }]} testID={`tile-${d.id}`}>
                <View style={styles.tileHead}>
                  <View style={[styles.dot, { backgroundColor: d.connected ? colors.success : colors.muted }]} />
                  <Text style={styles.tileName} numberOfLines={1}>
                    {d.name}
                    {d.id === deviceId ? " (moi)" : ""}
                  </Text>
                </View>
                <View style={styles.stateBadgeWrap}>
                  <Text
                    style={[
                      styles.stateBadge,
                      {
                        color:
                          d.state === "live" ? colors.error : d.state === "preview" ? colors.success : colors.muted,
                      },
                    ]}
                  >
                    {d.state === "live" ? "● LIVE" : d.state === "preview" ? "● PREVIEW" : "○ IDLE"}
                  </Text>
                </View>
                <View style={styles.tileBtns}>
                  <Pressable
                    testID={`pvw-${d.id}`}
                    onPress={() => setPreview(d)}
                    style={[styles.tileBtn, { backgroundColor: d.state === "preview" ? colors.success : colors.surfaceTertiary }]}
                  >
                    <Text style={[styles.tileBtnTxt, { color: d.state === "preview" ? colors.onSuccess : colors.onSurfaceTertiary }]}>PVW</Text>
                  </Pressable>
                  <Pressable
                    testID={`pgm-${d.id}`}
                    onPress={() => setLive(d)}
                    style={[styles.tileBtn, { backgroundColor: d.state === "live" ? colors.error : colors.surfaceTertiary }]}
                  >
                    <Text style={[styles.tileBtnTxt, { color: d.state === "live" ? colors.onError : colors.onSurfaceTertiary }]}>PGM</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 }]}>
        <Button label="BLACKOUT — Tout éteindre" icon="power" variant="danger" onPress={blackout} testID="blackout-button" />
      </View>
    </View>
  );
}

function Header({ insets, code }: { insets: { top: number }; code: string | null }) {
  const styles = useStyles();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>RÉGIE MULTICAM</Text>
      {code ? <Text style={styles.headerCode}>{code}</Text> : null}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, letterSpacing: 0.5 },
  headerCode: { fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary, letterSpacing: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  tileName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface, flex: 1 },
  stateBadgeWrap: {},
  stateBadge: { fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 0.5 },
  tileBtns: { flexDirection: "row", gap: 8 },
  tileBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileBtnTxt: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1 },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  dashed: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface },
  emptyDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: "center" },
}));
