// src/crypto/vault.ts
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

/** Encrypted envelope stored in the gist. No plaintext, no passphrase. */
export interface Envelope {
  v: 1;
  kdf: "scrypt";
  n: number;
  r: number;
  p: number;
  salt: string; // base64
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM standard

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, { N, r: R, p: P });
}

/** Encrypt plaintext with a passphrase. Returns a self-describing envelope. */
export function encrypt(plaintext: string, passphrase: string): Envelope {
  const salt = randomBytes(16);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    v: 1,
    kdf: "scrypt",
    n: N,
    r: R,
    p: P,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/**
 * Decrypt an envelope with a passphrase. Throws if the passphrase is wrong or
 * the data was tampered (GCM auth check fails). Caller maps this to a generic
 * "wrong passphrase or corrupt data" message — never leak which.
 */
export function decrypt(env: Envelope, passphrase: string): string {
  const salt = Buffer.from(env.salt, "base64");
  const iv = Buffer.from(env.iv, "base64");
  const authTag = Buffer.from(env.authTag, "base64");
  const ciphertext = Buffer.from(env.ciphertext, "base64");
  const key = scryptSync(passphrase, salt, KEY_LEN, {
    N: env.n,
    r: env.r,
    p: env.p,
  });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if auth fails
  ]);
  return plaintext.toString("utf8");
}
