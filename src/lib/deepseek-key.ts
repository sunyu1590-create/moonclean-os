const ITERATIONS = 600_000;
const source = (bytes: Uint8Array) => bytes as unknown as BufferSource;

export type DeepSeekEnvelope = {
  key_ciphertext: string;
  key_salt: string;
  key_iv: string;
};

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

export async function fetchDeepSeekKey(storeId: string, pin: string): Promise<{ apiKey: string; attemptsLeft: number }> {
  const base = `/api/stores/${encodeURIComponent(storeId)}/ai/deepseek`;
  const response = await fetch(base, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json() as { envelope?: DeepSeekEnvelope; configured?: boolean; locked?: boolean; error?: string };
  if (!response.ok || !data.envelope) throw new Error(data.locked ? "密码已累计输错五次，密钥已销毁，请在系统设置重新保存。" : data.error || "云端尚未保存 DeepSeek 密钥。");
  try {
    const apiKey = await decryptDeepSeekKey(data.envelope, pin);
    return { apiKey, attemptsLeft: 5 };
  } catch {
    const failed = await fetch(base, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "failed" }) });
    if (!failed.ok) throw new Error("无法记录密码错误次数，请检查网络后重试。");
    const result = await failed.json().catch(() => ({})) as { attemptsLeft?: number; destroyed?: boolean };
    if (result.destroyed) throw new Error("密码已累计输错五次，云端密钥已销毁。请在系统设置重新保存密钥并设置新密码。");
    throw new Error(`密码不正确，还可尝试 ${result.attemptsLeft ?? 0} 次。`);
  }
}
