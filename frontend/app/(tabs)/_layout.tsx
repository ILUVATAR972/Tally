import { Platform } from "react-native";
import { Tabs } from "expo-router";
import {
  NativeTabs,
  Icon as NativeIcon,
  Label as NativeLabel,
} from "expo-router/unstable-native-tabs";

import { Icon } from "@/src/components/ui/Icon";
import { fonts, useTheme } from "@/src/theme";

const useNative =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function TabsLayout() {
  const { colors } = useTheme();

  if (useNative) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeLabel>Accueil</NativeLabel>
          <NativeIcon sf="house.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="studio">
          <NativeLabel>Régie</NativeLabel>
          <NativeIcon sf="square.grid.2x2.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="obs">
          <NativeLabel>OBS</NativeLabel>
          <NativeIcon sf="dot.radiowaves.left.and.right" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="alarm">
          <NativeLabel>Alarme</NativeLabel>
          <NativeIcon sf="bell.fill" />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Icon name="home-variant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Régie",
          tabBarIcon: ({ color, size }) => <Icon name="view-grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="obs"
        options={{
          title: "OBS",
          tabBarIcon: ({ color, size }) => <Icon name="broadcast" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alarm"
        options={{
          title: "Alarme",
          tabBarIcon: ({ color, size }) => <Icon name="bell-ring" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
