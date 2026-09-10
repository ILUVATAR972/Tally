import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { Icon } from "@/src/components/ui/Icon";
import { useSession } from "@/src/context/session";
import { useOBS } from "@/src/context/obs";
import { DeviceState } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function TallyScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const { myState, deviceName, status: sessionStatus } = useSession();
  const { obsTally, assignedScene, status: obsStatus } = useOBS();

  const isObs = mode === "obs";
  const state: DeviceState = isObs ? obsTally : myState;
  const sourceName = isObs ? assignedScene || "OBS" : deviceName;
  const connLost = isObs ? obsStatus !== "connected" : sessionStatus !== "connected";

  const bg =
    state === "live" ? colors.error : state === "preview" ? colors.success : colors.surface;
  const fg =
    state === "live" ? colors.onError : state === "preview" ? colors.onSuccess : colors.muted;
  const bigText = state === "live" ? "LIVE" : state === "preview" ? "PREVIEW" : "STANDBY";

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (state === "live") {
      pulse.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [state, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.container, { backgroundColor: bg }]} testID="tally-screen">
      <StatusBar hidden />

      <Pressable
        testID="tally-close"
        onPress={() => router.back()}
        style={[styles.close, { top: insets.top + 12 }]}
        hitSlop={16}
      >
        <Icon name="close" size={26} color={fg} />
      </Pressable>

      <View style={styles.center}>
        {state === "idle" ? (
          <Icon name="power-sleep" size={64} color={colors.muted} />
        ) : (
          <Animated.View style={pulseStyle}>
            <Icon name={state === "live" ? "record-circle" : "eye"} size={72} color={fg} />
          </Animated.View>
        )}
        <Text style={[styles.big, { color: fg }]} testID="tally-state" numberOfLines={1} adjustsFontSizeToFit>
          {bigText}
        </Text>
        <Text style={[styles.source, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>
          {sourceName}
        </Text>
      </View>

      {connLost ? (
        <View style={[styles.lost, { bottom: insets.bottom + 20 }]}>
          <Icon name="wifi-off" size={16} color={colors.onError} />
          <Text style={styles.lostTxt}>CONNEXION PERDUE — RECONNEXION…</Text>
        </View>
      ) : (
        <Text style={[styles.footer, { bottom: insets.bottom + 20, color: fg }]}>
          {isObs ? "TALLY OBS" : "MODE AUTONOME"}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  close: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", gap: 12, paddingHorizontal: 24, alignSelf: "stretch" },
  big: { fontFamily: fonts.display, fontSize: 104, letterSpacing: 2, lineHeight: 110, textAlign: "center" },
  source: { fontFamily: fonts.displaySemi, fontSize: 32, letterSpacing: 1, opacity: 0.9, textAlign: "center" },
  footer: { position: "absolute", fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 3, opacity: 0.7 },
  lost: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.error,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lostTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.onError, letterSpacing: 1 },
}));
