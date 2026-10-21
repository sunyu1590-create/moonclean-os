const ITERATIONS = 600_000;
const source = (bytes: Uint8Array) => bytes as unknown as BufferSource;

export type DeepSeekEnvelope = {
  key_ciphertext: string;
  key_salt: string;
  key_iv: string;
};

export const DEEPSEEK_UNLOCK_DURATIONS = [
  { value: "per-call", label: "每次输入密码", milliseconds: 0 },
  { value: "5h", label: "5 小时后", milliseconds: 5 * 60 * 60 * 1000 },
  { value: "10h", label: "10 小时后", milliseconds: 10 * 60 * 60 * 1000 },
  { value: "1d", label: "1 天后", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "3 天后", milliseconds: 3 * 24 * 60 * 60 * 1000 },
] as const;
export type DeepSeekUnlockDuration = typeof DEEPSEEK_UNLOCK_DURATIONS[number]["value"];
const DEFAULT_DURATION: DeepSeekUnlockDuration = "3d";
const preferenceKey = (storeId: string) => `moonclean-deepseek-unlock-duration-v1:${storeId}`;
const cacheName = "moonclean-deepseek-unlock-v1";
type CachedKey = { storeId: string; key: CryptoKey; expiresAt: number };

export function getDeepSeekUnlockDuration(storeId: string): DeepSeekUnlockDuration {
  if (typeof window === "undefined") return DEFAULT_DURATION;
  try {
    const value = localStorage.getItem(preferenceKey(storeId));
    return DEEPSEEK_UNLOCK_DURATIONS.some((item) => item.value === value) ? value as DeepSeekUnlockDuration : DEFAULT_DURATION;
  } catch { return DEFAULT_DURATION; }
}

export async function setDeepSeekUnlockDuration(storeId: string, duration: DeepSeekUnlockDuration) {
  try { localStorage.setItem(preferenceKey(storeId), duration); } catch { /* The default can still be used for this session. */ }
  await clearCachedDeepSeekKey(storeId);
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(cacheName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys", { keyPath: "storeId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCachedKey(storeId: string): Promise<CachedKey | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openKeyDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("keys", "readonly").objectStore("keys").get(storeId);
      request.onsuccess = () => resolve((request.result as CachedKey | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeCachedKey(storeId: string, key: CryptoKey, expiresAt: number) {
  if (typeof indexedDB === "undefined") return;
  const db = await openKeyDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("keys", "readwrite");
      transaction.objectStore("keys").put({ storeId, key, expiresAt } satisfies CachedKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function clearCachedDeepSeekKey(storeId: string) {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openKeyDb();
    try { await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("keys", "readwrite");
      transaction.objectStore("keys").delete(storeId);
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    }); } finally { db.close(); }
  } catch { /* Missing or unavailable browser storage means the user will enter the PIN again. */ }
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: source(salt), iterations: ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptDeepSeekKey(apiKey: string, pin: string): Promise<DeepSeekEnvelope> {
  if (!/^\d{4}$/.test(pin)) throw new Error("密码必须为四位数字。");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: source(iv) }, key, source(new TextEncoder().encode(apiKey.trim())));
  return { key_ciphertext: encode(new Uint8Array(encrypted)), key_salt: encode(salt), key_iv: encode(iv) };
}

export async function decryptDeepSeekKey(envelope: DeepSeekEnvelope, pin: string) {
  const key = await deriveKey(pin, decode(envelope.key_salt));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: source(decode(envelope.key_iv)) }, key, source(decode(envelope.key_ciphertext)));
  return new TextDecoder().decode(plain);
}

async function decryptWithKey(envelope: DeepSeekEnvelope, key: CryptoKey) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: source(decode(envelope.key_iv)) }, key, source(decode(envelope.key_ciphertext)));
  return new TextDecoder().decode(plain);
}

async function getEnvelope(storeId: string) {
  const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/ai/deepseek`, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json() as { envelope?: DeepSeekEnvelope; configured?: boolean; locked?: boolean; error?: string };
  if (!response.ok || !data.envelope) throw new Error(data.locked ? "密码已累计输错五次，密钥已销毁，请在系统设置重新保存。" : data.error || "云端尚未保存 DeepSeek 密钥。");
  return data.envelope;
}

export async function getCachedDeepSeekKey(storeId: string): Promise<string | null> {
  if (getDeepSeekUnlockDuration(storeId) === "per-call") { await clearCachedDeepSeekKey(storeId); return null; }
  try {
    const cached = await readCachedKey(storeId);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) { await clearCachedDeepSeekKey(storeId); return null; }
    return await decryptWithKey(await getEnvelope(storeId), cached.key);
  } catch {
    await clearCachedDeepSeekKey(storeId);
    return null;
  }
}

export async function fetchDeepSeekKey(storeId: string, pin: string): Promise<{ apiKey: string; attemptsLeft: number }> {
  const base = `/api/stores/${encodeURIComponent(storeId)}/ai/deepseek`;
  const envelope = await getEnvelope(storeId);
  try {
    const key = await deriveKey(pin, decode(envelope.key_salt));
    const apiKey = await decryptWithKey(envelope, key);
    const duration = DEEPSEEK_UNLOCK_DURATIONS.find((item) => item.value === getDeepSeekUnlockDuration(storeId));
    if (duration && duration.milliseconds > 0) {
      try { await writeCachedKey(storeId, key, Date.now() + duration.milliseconds); } catch { /* If persistent browser storage is unavailable, do not retain the API key. */ }
    } else await clearCachedDeepSeekKey(storeId);
    return { apiKey, attemptsLeft: 5 };
  } catch {
    const failed = await fetch(base, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "failed" }) });
    if (!failed.ok) throw new Error("无法记录密码错误次数，请检查网络后重试。");
    const result = await failed.json().catch(() => ({})) as { attemptsLeft?: number; destroyed?: boolean };
    if (result.destroyed) throw new Error("密码已累计输错五次，云端密钥已销毁。请在系统设置重新保存密钥并设置新密码。");
    throw new Error(`密码不正确，还可尝试 ${result.attemptsLeft ?? 0} 次。`);
  }
}
