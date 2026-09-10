import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";

import { storage } from "@/src/utils/storage";
import { wsUrl } from "@/src/lib/net";
import { createSession, getSession, Device, DeviceState } from "@/src/lib/api";

type ConnStatus = "disconnected" | "connecting" | "connected";

type AlarmPayload = {
  message: string;
  sender: string;
  sound: boolean;
  vibrate: boolean;
  flash: boolean;
};

type SessionContextValue = {
  deviceId: string;
  deviceName: string;
  code: string | null;
  devices: Device[];
  status: ConnStatus;
  myState: DeviceState;
  ready: boolean;
  setDeviceName: (name: string) => Promise<void>;
  startSession: (studioName?: string) => Promise<string>;
  connect: (code: string) => Promise<void>;
  leave: () => Promise<void>;
  setState: (targetId: string, state: DeviceState) => void;
  blackout: () => void;
  sendAlarm: (targetId: string, payload: AlarmPayload) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const KEY_DEVICE_ID = "stp.deviceId";
const KEY_DEVICE_NAME = "stp.deviceName";
const KEY_CODE = "stp.code";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceNameState] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<ConnStatus>("disconnected");
  const [ready, setReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const codeRef = useRef<string | null>(null);
  const intentionalClose = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const identity = useRef({ id: "", name: "" });

  // bootstrap identity + last session
  useEffect(() => {
    (async () => {
      let id = await storage.getItem<string>(KEY_DEVICE_ID, "");
      if (!id) {
        id = Crypto.randomUUID();
        await storage.setItem(KEY_DEVICE_ID, id);
      }
      let name = await storage.getItem<string>(KEY_DEVICE_NAME, "");
      if (!name) {
        name = "Caméra " + Math.floor(Math.random() * 90 + 10);
        await storage.setItem(KEY_DEVICE_NAME, name);
      }
      identity.current = { id, name };
      setDeviceId(id);
      setDeviceNameState(name);
      const savedCode = await storage.getItem<string>(KEY_CODE, "");
      setReady(true);
      if (savedCode) {
        openSocket(savedCode);
      }
    })();
    return () => {
      intentionalClose.current = true;
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSocket = useCallback((joinCode: string) => {
    const c = joinCode.toUpperCase();
    codeRef.current = c;
    setCode(c);
    intentionalClose.current = false;
    setStatus("connecting");

    try {
      const url = wsUrl(c, identity.current.id, identity.current.name, "camera");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        storage.setItem(KEY_CODE, c);
        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {}
        }, 20000);
      };

      ws.onmessage = (evt) => {
        let msg: any;
        try {
          msg = JSON.parse(evt.data as string);
        } catch {
          return;
        }
        if (msg.type === "snapshot" || msg.type === "device_list") {
          setDevices(msg.devices || []);
        } else if (msg.type === "alarm") {
          router.push({
            pathname: "/alert",
            params: {
              message: msg.message ?? "Alerte",
              sender: msg.sender ?? "",
              sound: msg.sound ? "1" : "0",
              vibrate: msg.vibrate ? "1" : "0",
              flash: msg.flash ? "1" : "0",
            },
          });
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingTimer.current) clearInterval(pingTimer.current);
        if (!intentionalClose.current && codeRef.current) {
          reconnectTimer.current = setTimeout(() => openSocket(codeRef.current!), 2500);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    } catch {
      setStatus("disconnected");
    }
  }, [router]);

  const startSession = useCallback(async (studioName?: string) => {
    const { code: newCode } = await createSession(studioName);
    openSocket(newCode);
    return newCode;
  }, [openSocket]);

  const connect = useCallback(async (joinCode: string) => {
    // validate it exists first (throws if not)
    await getSession(joinCode.toUpperCase());
    openSocket(joinCode);
  }, [openSocket]);

  const leave = useCallback(async () => {
    intentionalClose.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    codeRef.current = null;
    setCode(null);
    setDevices([]);
    setStatus("disconnected");
    await storage.removeItem(KEY_CODE);
  }, []);

  const send = useCallback((obj: any): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }, []);

  const setState = useCallback((targetId: string, state: DeviceState) => {
    // optimistic
    setDevices((prev) => prev.map((d) => (d.id === targetId ? { ...d, state } : d)));
    send({ type: "set_state", target_id: targetId, state });
  }, [send]);

  const blackout = useCallback(() => {
    setDevices((prev) => prev.map((d) => ({ ...d, state: "idle" as DeviceState })));
    send({ type: "blackout" });
  }, [send]);

  const sendAlarm = useCallback((targetId: string, payload: AlarmPayload): boolean => {
    return send({ type: "alarm", target_id: targetId, ...payload });
  }, [send]);

  const setDeviceName = useCallback(async (name: string) => {
    identity.current.name = name;
    setDeviceNameState(name);
    await storage.setItem(KEY_DEVICE_NAME, name);
    send({ type: "rename", name });
  }, [send]);

  const myState: DeviceState = useMemo(() => {
    return devices.find((d) => d.id === deviceId)?.state ?? "idle";
  }, [devices, deviceId]);

  const value: SessionContextValue = {
    deviceId,
    deviceName,
    code,
    devices,
    status,
    myState,
    ready,
    setDeviceName,
    startSession,
    connect,
    leave,
    setState,
    blackout,
    sendAlarm,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
