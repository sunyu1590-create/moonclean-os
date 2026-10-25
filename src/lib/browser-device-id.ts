const DEVICE_ID_KEY = "moonclean-browser-device-id-v1";

export function getBrowserDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY);
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
    const id = window.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}
