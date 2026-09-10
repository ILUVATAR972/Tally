import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";

import { Icon } from "@/src/components/ui/Icon";
import { Button } from "@/src/components/ui/Button";
import { useSession } from "@/src/context/session";
import { DeviceState } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function CameraScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { myState, deviceName } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");

  const state: DeviceState = myState;
  const borderColor =
    state === "live" ? colors.error : state === "preview" ? colors.success : "transparent";
  const stateLabel = state === "live" ? "● LIVE" : state === "preview" ? "● PREVIEW" : "";

  // Permission gate
  if (!permission) {
    return <View style={[styles.container, styles.center]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="light" />
        <Icon name="camera-outline" size={64} color={colors.brandPrimary} />
        <Text style={styles.permTitle}>Accès à la caméra</Text>
        <Text style={styles.permDesc}>
          Transformez ce téléphone en caméra surveillée avec voyant tally intégré.
        </Text>
        {permission.canAskAgain ? (
          <Button label="Autoriser la caméra" icon="camera" onPress={requestPermission} testID="camera-permission-button" />
        ) : (
          <Button
            label="Ouvrir les réglages"
            icon="cog"
            onPress={() => Linking.openSettings()}
            testID="camera-settings-button"
          />
        )}
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginTop: 8 }}>
          <Text style={styles.backTxt}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="camera-screen">
      <StatusBar hidden />
      <CameraView style={styles.camera} facing={facing} />

      {/* Tally border overlay */}
      <View pointerEvents="none" style={[styles.tallyBorder, { borderColor }]} />

      {/* Top controls */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable testID="camera-close" onPress={() => router.back()} hitSlop={16} style={styles.iconBtn}>
          <Icon name="close" size={24} color="#ffffff" />
        </Pressable>
        {stateLabel ? (
          <View style={[styles.stateBadge, { backgroundColor: state === "live" ? colors.error : colors.success }]}>
            <Text style={[styles.stateBadgeTxt, { color: state === "live" ? colors.onError : colors.onSuccess }]}>
              {stateLabel}
            </Text>
          </View>
        ) : null}
        <Pressable
          testID="camera-flip"
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          hitSlop={16}
          style={styles.iconBtn}
        >
          <Icon name="camera-flip" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {/* Bottom info */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]}>
        <Text style={styles.camName}>{deviceName}</Text>
        <Text style={styles.note}>Aperçu local · flux vidéo OBS = build natif requis</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: "#000000" },
  center: { alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  camera: { ...({ position: "absolute" } as const), top: 0, left: 0, right: 0, bottom: 0 },
  tallyBorder: {
    ...({ position: "absolute" } as const),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 14,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  stateBadge: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  stateBadgeTxt: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1 },
  bottomBar: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 4 },
  camName: { fontFamily: fonts.display, fontSize: 24, color: "#ffffff", letterSpacing: 1 },
  note: { fontFamily: fonts.body, fontSize: 11, color: "rgba(255,255,255,0.7)" },
  permTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.onSurface },
  permDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 8 },
  backTxt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted, textDecorationLine: "underline" },
}));
