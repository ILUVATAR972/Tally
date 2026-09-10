import { API } from "./net";

export type DeviceState = "idle" | "preview" | "live";

export type Device = {
  id: string;
  session_code: string;
  name: string;
  role: string;
  state: DeviceState;
  connected: boolean;
};

export type Snapshot = { code: string; devices: Device[] };

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let detail = "Erreur réseau";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function createSession(name?: string): Promise<{ code: string }> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res);
}

export async function getSession(code: string): Promise<Snapshot> {
  const res = await fetch(`${API}/sessions/${code}`);
  return jsonOrThrow(res);
}

export async function joinSession(
  code: string,
  device_id: string,
  name: string,
  role: string,
): Promise<Snapshot> {
  const res = await fetch(`${API}/sessions/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id, name, role }),
  });
  return jsonOrThrow(res);
}
