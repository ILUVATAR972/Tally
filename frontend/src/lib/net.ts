const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export const API = `${BASE}/api`;

export function wsUrl(code: string, deviceId: string, name: string, role: string): string {
  const proto = BASE.startsWith("https") ? "wss" : "ws";
  const host = BASE.replace(/^https?:\/\//, "");
  const params = new URLSearchParams({ name, role }).toString();
  return `${proto}://${host}/api/ws/${code}/${deviceId}?${params}`;
}
