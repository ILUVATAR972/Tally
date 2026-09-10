import { useEffect } from "react";
import { Text, Vibration, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { Icon } from "@/src/components/ui/Icon";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const alarmSound = require("../assets/sounds/alarm.mp3");

export default function AlertScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    message?: string;
    sender?: string;
    sound?: string;
    vibrate?: string;
    flash?: string;
  }>();

  const message = params.message || "Alerte";
  const sender = params.sender || "";
  const useSound = params.sound !== "0";
  const useVibrate = params.vibrate !== "0";
  const useFlash = params.flash !== "0";

  const player = useAudioPlayer(alarmSound);
  const flash = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (useFlash) {
      flash.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);
    }
    if (useVibrate) {
      Vibration.vibrate([0, 500, 350, 500, 350], true);
    }
    if (useSound) {
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      try {
        player.loop = true;
        player.play();
      } catch {}
    }
    return () => {
      cancelAnimation(flash);
      Vibration.cancel();
      try {
        player.pause();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    Vibration.cancel();
    try {
      player.pause();
    } catch {}
    router.back();
  };

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: useFlash
      ? interpolateColor(flash.value, [0, 1], [colors.surface, colors.error])
      : colors.error,
  }));

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const hold = Gesture.LongPress()
    .minDuration(900)
    .onBegin(() => {
      progress.value = withTiming(1, { duration: 900 });
    })
    .onStart(() => {
      runOnJS(dismiss)();
    })
    .onFinalize(() => {
      progress.value = withTiming(0, { duration: 200 });
    });

  return (
    <Animated.View style={[styles.container, bgStyle]} testID="alert-screen">
      <StatusBar hidden />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.top}>
          <Icon name="bell-ring" size={72} color={colors.onError} />
          <Text style={styles.incoming}>APPEL ENTRANT</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.message} testID="alert-message">
            {message}
          </Text>
          {sender ? <Text style={styles.sender}>de {sender}</Text> : null}
        </View>

        <GestureDetector gesture={hold}>
          <View style={styles.holdBtn} testID="alert-dismiss">
            <Animated.View style={[styles.holdProgress, barStyle]} />
            <View style={styles.holdInner}>
              <Icon name="gesture-tap-hold" size={24} color={colors.onSurface} />
              <Text style={styles.holdTxt}>MAINTENIR POUR ARRÊTER</Text>
            </View>
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between", alignItems: "center" },
  top: { alignItems: "center", gap: 12 },
  incoming: { fontFamily: fonts.display, fontSize: 24, color: colors.onError, letterSpacing: 4 },
  middle: { alignItems: "center", gap: 10 },
  message: { fontFamily: fonts.display, fontSize: 52, color: colors.onError, textAlign: "center", lineHeight: 56 },
  sender: { fontFamily: fonts.bodyMedium, fontSize: 18, color: colors.onError, opacity: 0.85 },
  holdBtn: {
    width: "100%",
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
    justifyContent: "center",
  },
  holdProgress: {
    ...({ position: "absolute" } as const),
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brandPrimary,
  },
  holdInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  holdTxt: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface, letterSpacing: 1 },
}));
