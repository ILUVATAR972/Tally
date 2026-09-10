import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { useOBS } from "@/src/context/obs";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function OBSScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    status,
    error,
    scenes,
    programScene,
    previewScene,
    assignedScene,
    host,
    port,
    password,
    setHost,
    setPort,
    setPassword,
    connect,
    disconnect,
    assignScene,
  } = useOBS();

  const connected = status === "connected";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>CONNEXION OBS</Text>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  status === "connected"
                    ? colors.success
                    : status === "connecting"
                    ? colors.warning
                    : status === "error"
                    ? colors.error
                    : colors.muted,
              },
            ]}
          />
          <Text style={styles.statusTxt}>
            {status === "connected"
              ? "CONNECTÉ"
              : status === "connecting"
              ? "CONNEXION…"
              : status === "error"
              ? "ÉCHEC"
              : "HORS LIGNE"}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.hint}>
            Dans OBS : Outils → Paramètres du serveur WebSocket → Activer. Notez l'adresse IP de votre PC, le port (4455) et le mot de passe.
          </Text>

          <Text style={styles.label}>ADRESSE IP DU PC</Text>
          <View style={styles.row}>
            <TextField value={host} onChangeText={setHost} placeholder="192.168.1.20" keyboardType="numbers-and-punctuation" testID="obs-host-input" style={{ flex: 2 }} />
            <TextField value={port} onChangeText={setPort} placeholder="4455" keyboardType="number-pad" testID="obs-port-input" style={{ flex: 1 }} />
          </View>

          <Text style={styles.label}>MOT DE PASSE</Text>
          <TextField value={password} onChangeText={setPassword} placeholder="Mot de passe WebSocket" secureTextEntry testID="obs-password-input" />

          {connected ? (
            <Button label="Déconnecter" icon="lan-disconnect" variant="ghost" onPress={disconnect} testID="obs-disconnect-button" />
          ) : (
            <Button
              label={status === "connecting" ? "Connexion…" : "Connecter à OBS"}
              icon="lan-connect"
              onPress={connect}
              loading={status === "connecting"}
              testID="obs-connect-button"
            />
          )}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={20} color={colors.onError} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {connected ? (
          <>
            <Text style={styles.section}>ASSIGNER UNE SCÈNE À CE TÉLÉPHONE</Text>
            {scenes.length === 0 ? (
              <Text style={styles.hint}>Aucune scène trouvée.</Text>
            ) : (
              scenes.map((s) => {
                const isProgram = s === programScene;
                const isPreview = s === previewScene;
                const isAssigned = s === assignedScene;
                return (
                  <Pressable
                    key={s}
                    testID={`scene-${s}`}
                    onPress={() => assignScene(s)}
                    style={[styles.sceneRow, isAssigned && { borderColor: colors.brandPrimary }]}
                  >
                    <Icon
                      name={isAssigned ? "check-circle" : "circle-outline"}
                      size={22}
                      color={isAssigned ? colors.brandPrimary : colors.muted}
                    />
                    <Text style={styles.sceneName} numberOfLines={1}>
                      {s}
                    </Text>
                    {isProgram ? <Text style={[styles.tag, { color: colors.error }]}>LIVE</Text> : null}
                    {isPreview ? <Text style={[styles.tag, { color: colors.success }]}>PVW</Text> : null}
                  </Pressable>
                );
              })
            )}

            {assignedScene ? (
              <Button
                label={`Ouvrir le Tally (${assignedScene})`}
                icon="lightbulb-on"
                onPress={() => router.push("/tally?mode=obs")}
                testID="open-obs-tally-button"
                style={{ marginTop: 8 }}
              />
            ) : null}
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function TextField(props: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { style, ...rest } = props;
  return (
    <View style={[styles.inputWrap, style]}>
      <TextInput
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  statusTxt: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.onSurfaceSecondary, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.onSurfaceSecondary, letterSpacing: 1, marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  inputWrap: {},
  input: {
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
  errorBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 14,
  },
  errorTxt: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onError, lineHeight: 18 },
  section: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 2, marginTop: 6 },
  sceneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
  },
  sceneName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.onSurface },
  tag: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
}));
