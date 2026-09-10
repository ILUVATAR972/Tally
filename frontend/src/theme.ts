// Design tokens for StudioTally Pro. Dark-first "studio/pro" utility theme.
//
// The keys match the "color" block of /app/design_guidelines.json. The app is
// intentionally dark-only, so the palette lives in the single active scheme.
// Never write color literals in components; read from here via makeStyles /
// useTheme.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

// Font families loaded in app/_layout.tsx from bundled ttf files.
export const fonts = {
  display: "BarlowCondensed-Bold",
  displaySemi: "BarlowCondensed-SemiBold",
  displayMedium: "BarlowCondensed-Medium",
  body: "IBMPlexSans-Regular",
  bodyMedium: "IBMPlexSans-Medium",
  bodySemi: "IBMPlexSans-SemiBold",
};

const dark = {
  // Surfaces
  surface: "#0a0a0a",
  onSurface: "#ffffff",
  surfaceSecondary: "#161618",
  onSurfaceSecondary: "#e0e0e0",
  surfaceTertiary: "#222225",
  onSurfaceTertiary: "#c0c0c0",
  surfaceInverse: "#ffffff",
  onSurfaceInverse: "#000000",
  muted: "#888888",

  // Brand (amber)
  brand: "#FFB300",
  onBrand: "#000000",
  brandPrimary: "#FFB300",
  onBrandPrimary: "#000000",
  brandSecondary: "#333333",
  onBrandSecondary: "#ffffff",
  brandTertiary: "#4D3600",
  onBrandTertiary: "#FFB300",

  // Status  (success = PREVIEW green, error = LIVE red)
  success: "#00E676",
  onSuccess: "#000000",
  warning: "#FFB300",
  onWarning: "#000000",
  error: "#FF3333",
  onError: "#ffffff",
  info: "#444444",
  onInfo: "#ffffff",

  // Lines
  border: "#2a2a2a",
  borderStrong: "#444444",
  divider: "#1f1f1f",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

// App ships dark only; both device schemes resolve to the same studio palette.
export const themes: { light: ThemeColors; dark: ThemeColors } = { light: dark, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
