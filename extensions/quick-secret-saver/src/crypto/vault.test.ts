// src/crypto/vault.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt, Envelope } from "./vault";

describe("vault", () => {
  it("decrypt(encrypt(x)) round-trips the plaintext", () => {
    const env = encrypt("hello secret", "pw");
    expect(decrypt(env, "pw")).toBe("hello secret");
  });

  it("round-trips unicode and empty strings", () => {
    expect(decrypt(encrypt("", "pw"), "pw")).toBe("");
    expect(decrypt(encrypt("密码🔐", "pw"), "pw")).toBe("密码🔐");
  });

  it("produces a well-formed envelope", () => {
    const env = encrypt("x", "pw");
    expect(env.v).toBe(1);
    expect(env.kdf).toBe("scrypt");
    for (const f of ["salt", "iv", "authTag", "ciphertext"] as const) {
      expect(typeof env[f]).toBe("string");
      expect(env[f].length).toBeGreaterThan(0);
    }
  });

  it("uses a fresh salt and iv each call", () => {
    const a = encrypt("x", "pw");
    const b = encrypt("x", "pw");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws on wrong passphrase", () => {
    const env = encrypt("secret", "right");
    expect(() => decrypt(env, "wrong")).toThrow();
  });

  it("throws when ciphertext is tampered", () => {
    const env = encrypt("secret", "pw");
    const tampered: Envelope = {
      ...env,
      ciphertext: flipBase64(env.ciphertext),
    };
    expect(() => decrypt(tampered, "pw")).toThrow();
  });

  it("throws when authTag is tampered", () => {
    const env = encrypt("secret", "pw");
    const tampered: Envelope = { ...env, authTag: flipBase64(env.authTag) };
    expect(() => decrypt(tampered, "pw")).toThrow();
  });
});

// Flip the first byte of a base64 payload to corrupt it deterministically.
function flipBase64(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  buf[0] = buf[0] ^ 0xff;
  return buf.toString("base64");
}
