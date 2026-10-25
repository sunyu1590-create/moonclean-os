import { createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPddSignature, buildPddTokenRequest, createPddOAuthState, encryptPddCredential, verifyPddOAuthState } from "./pinduoduo-oauth";

const key = Buffer.alloc(32, 7).toString("base64");
const signingSecret = "s".repeat(40);

describe("Pinduoduo OAuth helpers", () => {
  it("creates a provider request signature from sorted parameters", () => {
    expect(buildPddSignature({ code: "xyz", client_id: "abc" }, "secret"))
      .toBe(buildPddSignature({ client_id: "abc", code: "xyz" }, "secret"));
    expect(buildPddTokenRequest("client", "secret", "auth-code", "1770000000")).toMatchObject({
      client_id: "client",
      code: "auth-code",
      data_type: "JSON",
      timestamp: "1770000000",
      type: "pdd.pop.auth.token.create",
    });
  });

  it("signs, validates, expires, and rejects modified OAuth state", () => {
    const issuedAt = 1_770_000_000;
    const token = createPddOAuthState({ storeId: "store", connectionId: "connection", userId: "user", issuedAt, nonce: "random" }, signingSecret);
    expect(verifyPddOAuthState(token, signingSecret, issuedAt + 30)).toMatchObject({ storeId: "store", userId: "user" });
    expect(verifyPddOAuthState(`${token}x`, signingSecret, issuedAt + 30)).toBeNull();
    expect(verifyPddOAuthState(token, signingSecret, issuedAt + 601)).toBeNull();
  });

  it("encrypts credentials with an authenticated AES-256-GCM envelope", () => {
    const secret = "pdd-access-token-do-not-expose";
    const envelope = encryptPddCredential(secret, key);
    expect(envelope).toMatch(/^\\x[0-9a-f]+$/);
    expect(envelope).not.toContain(secret);
    const packed = Buffer.from(envelope.slice(2), "hex");
    expect(packed[0]).toBe(1);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), packed.subarray(1, 13));
    decipher.setAuthTag(packed.subarray(13, 29));
    const plaintext = Buffer.concat([decipher.update(packed.subarray(29)), decipher.final()]).toString("utf8");
    expect(plaintext).toBe(secret);
    expect(encryptPddCredential(secret, key)).not.toBe(envelope);
    expect(() => encryptPddCredential(secret, "invalid")).toThrow();
  });
});
