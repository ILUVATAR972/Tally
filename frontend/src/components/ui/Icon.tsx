import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

import { useTheme } from "@/src/theme";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useTheme();
  return <MaterialDesignIcons name={name as any} size={size} color={color ?? colors.onSurface} />;
}
