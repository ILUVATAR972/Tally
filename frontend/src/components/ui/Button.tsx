import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  haptic?: Haptics.ImpactFeedbackStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
  haptic = Haptics.ImpactFeedbackStyle.Medium,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const bg =
    variant === "primary"
      ? styles.primary
      : variant === "danger"
      ? styles.danger
      : variant === "ghost"
      ? styles.ghost
      : styles.secondary;

  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
      ? colors.onError
      : variant === "ghost"
      ? colors.onSurfaceSecondary
      : colors.onBrandSecondary;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(haptic).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        bg,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: { backgroundColor: colors.brandSecondary },
  danger: { backgroundColor: colors.error },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    letterSpacing: 0.3,
  },
}));
