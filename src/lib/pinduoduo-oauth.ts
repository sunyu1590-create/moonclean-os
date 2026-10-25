import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PDD_REDIRECT_URI = "https://moonclean.cloud/api/pdd/callback";
export const PDD_AUTHORIZATION_URL = "https://fuwu.pinduoduo.com/service-market/auth";
export const PDD_TOKEN_URL = "https://gw-api.pinduoduo.com/api/router";
export const PDD_STATE_TTL_SECONDS = 10 * 60;

export type PddOAuthState = {
  storeId: string;
  connectionId: string;
  userId: string;
  issuedAt: number;
  nonce: string;
};

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createPddOAuthState(state: PddOAuthState, signingSecret: string) {
  if (Buffer.byteLength(signingSecret) < 32) throw new Error("PDD_OAUTH_STATE_SECRET must be at least 32 bytes");
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", signingSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPddOAuthState(token: string, signingSecret: string, now = Math.floor(Date.now() / 1000)): PddOAuthState | null {
  if (Buffer.byteLength(signingSecret) < 32) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", signingSecret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PddOAuthState>;
    if (typeof state.storeId !== "string" || typeof state.connectionId !== "string" || typeof state.userId !== "string" || typeof state.nonce !== "string" || typeof state.issuedAt !== "number") return null;
    if (state.issuedAt > now + 30 || now - state.issuedAt > PDD_STATE_TTL_SECONDS) return null;
    return state as PddOAuthState;
  } catch {
    return null;
  }
}

export function buildPddSignature(params: Record<string, string>, clientSecret: string) {
  const canonical = Object.keys(params).filter(key => key !== "sign").sort().map(key => `${key}${params[key]}`).join("");
  return createHash("md5").update(`${clientSecret}${canonical}${clientSecret}`, "utf8").digest("hex").toUpperCase();
}

export function encryptPddCredential(value: string, base64Key: string) {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== base64Key.replace(/=+$/, "")) {
    throw new Error("PDD_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const packed = Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
  return `\\x${packed.toString("hex")}`;
}

export function buildPddTokenRequest(clientId: string, clientSecret: string, code: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const params = {
    client_id: clientId,
    code,
    data_type: "JSON",
    timestamp,
    type: "pdd.pop.auth.token.create",
  };
  return { ...params, sign: buildPddSignature(params, clientSecret) };
}

export function randomPddStateNonce() {
  return randomBytes(24).toString("base64url");
}

