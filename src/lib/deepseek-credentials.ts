import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const serverSecret = process.env.SUPABASE_SECRET_KEY;
  if (!serverSecret) throw new Error("服务器未配置 Supabase 服务端密钥");
  return createHash("sha256").update("moonclean-store-ai-credentials:v1:").update(serverSecret).digest();
}

export function encryptDeepSeekKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptDeepSeekKey(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("已保存的 DeepSeek 密钥格式无法识别");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}
