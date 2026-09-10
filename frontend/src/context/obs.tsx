import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Crypto from "expo-crypto";

import { storage } from "@/src/utils/storage";
import { DeviceState } from "@/src/lib/api";

type OBSStatus = "disconnected" | "connecting" | "connected" | "error";

type OBSContextValue = {
  status: OBSStatus;
  error: string | null;
  scenes: string[];
  programScene: string | null;
  previewScene: string | null;
  studioMode: boolean;
  assignedScene: string | null;
  host: string;
  port: string;
  password: string;
  obsTally: DeviceState;
  ready: boolean;
  setHost: (v: string) => void;
  setPort: (v: string) => void;
  setPassword: (v: string) => void;
  connect: () => void;
  disconnect: () => void;
  assignScene: (scene: string) => void;
};

const OBSContext = createContext<OBSContextValue | null>(null);

const KEY_HOST = "stp.obs.host";
const KEY_PORT = "stp.obs.port";
const KEY_PW = "stp.obs.pw";
const KEY_SCENE = "stp.obs.scene";

async function makeAuth(password: string, salt: string, challenge: string): Promise<string> {
  const secret = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + salt,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    secret + challenge,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
}

export function OBSProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OBSStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<string[]>([]);
  const [programScene, setProgramScene] = useState<string | null>(null);
  const [previewScene, setPreviewScene] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState(false);
  const [assignedScene, setAssignedScene] = useState<string | null>(null);
  const [host, setHostState] = useState("");
  const [port, setPortState] = useState("4455");
  const [password, setPasswordState] = useState("");
  const [ready, setReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    (async () => {
      setHostState(await storage.getItem<string>(KEY_HOST, ""));
      setPortState(await storage.getItem<string>(KEY_PORT, "4455"));
      setPasswordState(await storage.getItem<string>(KEY_PW, ""));
      setAssignedScene(await storage.getItem<string>(KEY_SCENE, ""));
      setReady(true);
    })();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const setHost = (v: string) => {
    setHostState(v);
    storage.setItem(KEY_HOST, v);
  };
  const setPort = (v: string) => {
    setPortState(v);
    storage.setItem(KEY_PORT, v);
  };
  const setPassword = (v: string) => {
    setPasswordState(v);
    storage.setItem(KEY_PW, v);
  };

  const request = (ws: WebSocket, requestType: string, requestData: any = {}) => {
    ws.send(
      JSON.stringify({
        op: 6,
        d: { requestType, requestId: Crypto.randomUUID(), requestData },
      }),
    );
  };

  const connect = useCallback(() => {
    if (!host) {
      setError("Adresse IP requise");
      setStatus("error");
      return;
    }
    try {
      wsRef.current?.close();
    } catch {}
    setError(null);
    setStatus("connecting");

    try {
      const url = `ws://${host}:${port || "4455"}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = async (evt) => {
        let msg: any;
        try {
          msg = JSON.parse(evt.data as string);
        } catch {
          return;
        }
        const { op, d } = msg;

        if (op === 0) {
          // Hello -> Identify
          const identify: any = { op: 1, d: { rpcVersion: 1 } };
          if (d.authentication) {
            identify.d.authentication = await makeAuth(
              password,
              d.authentication.salt,
              d.authentication.challenge,
            );
          }
          ws.send(JSON.stringify(identify));
        } else if (op === 2) {
          // Identified
          setStatus("connected");
          setError(null);
          request(ws, "GetSceneList");
          request(ws, "GetStudioModeEnabled");
        } else if (op === 5) {
          // Event
          const { eventType, eventData } = d;
          if (eventType === "CurrentProgramSceneChanged") {
            setProgramScene(eventData.sceneName);
          } else if (eventType === "CurrentPreviewSceneChanged") {
            setPreviewScene(eventData.sceneName);
          } else if (eventType === "StudioModeStateChanged") {
            setStudioMode(!!eventData.studioModeEnabled);
          } else if (eventType === "SceneListChanged") {
            const list = (eventData.scenes || []).map((s: any) => s.sceneName).reverse();
            setScenes(list);
          }
        } else if (op === 7) {
          // RequestResponse
          const rt = d.requestType;
          const rd = d.responseData || {};
          if (rt === "GetSceneList") {
            const list = (rd.scenes || []).map((s: any) => s.sceneName).reverse();
            setScenes(list);
            setProgramScene(rd.currentProgramSceneName ?? null);
            setPreviewScene(rd.currentPreviewSceneName ?? null);
          } else if (rt === "GetStudioModeEnabled") {
            setStudioMode(!!rd.studioModeEnabled);
          }
        }
      };

      ws.onerror = () => {
        setStatus("error");
        setError("Connexion impossible. Vérifiez l'IP, le port et qu'OBS est ouvert sur le même réseau WiFi.");
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === "error" ? "error" : "disconnected"));
      };
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Connexion impossible");
    }
  }, [host, port, password]);

  const disconnect = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    setStatus("disconnected");
    setScenes([]);
    setProgramScene(null);
    setPreviewScene(null);
  }, []);

  const assignScene = useCallback((scene: string) => {
    setAssignedScene(scene);
    storage.setItem(KEY_SCENE, scene);
  }, []);

  const obsTally: DeviceState = useMemo(() => {
    if (!assignedScene) return "idle";
    if (programScene && assignedScene === programScene) return "live";
    if (studioMode && previewScene && assignedScene === previewScene) return "preview";
    return "idle";
  }, [assignedScene, programScene, previewScene, studioMode]);

  const value: OBSContextValue = {
    status,
    error,
    scenes,
    programScene,
    previewScene,
    studioMode,
    assignedScene,
    host,
    port,
    password,
    obsTally,
    ready,
    setHost,
    setPort,
    setPassword,
    connect,
    disconnect,
    assignScene,
  };

  return <OBSContext.Provider value={value}>{children}</OBSContext.Provider>;
}

export function useOBS(): OBSContextValue {
  const ctx = useContext(OBSContext);
  if (!ctx) throw new Error("useOBS must be used within OBSProvider");
  return ctx;
}
