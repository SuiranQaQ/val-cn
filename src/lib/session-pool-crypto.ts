import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const SCRYPT_SALT = "val-cn-session-pool-v1";

function deriveKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, SCRYPT_SALT, 32);
}

function encryptionKey(): Buffer | null {
  const raw = process.env.SESSION_POOL_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return deriveKey(raw);
}

export function isPoolEncryptionEnabled(): boolean {
  return encryptionKey() !== null;
}

/** 加密敏感字段（AES-256-GCM） */
export function sealPoolSecret(plaintext: string): string {
  const key = encryptionKey();
  if (!key) {
    throw new Error("pool_encryption_key_missing");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function openPoolSecret(sealed: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  try {
    const parsed = JSON.parse(sealed) as {
      iv?: string;
      tag?: string;
      data?: string;
    };
    if (!parsed.iv || !parsed.tag || !parsed.data) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export function getPoolContributeSecret(): string {
  return process.env.SESSION_POOL_CONTRIBUTE_SECRET?.trim() || "";
}

export function getPoolReadSecret(): string {
  return (
    process.env.SESSION_POOL_READ_SECRET?.trim() ||
    process.env.SESSION_POOL_INTERNAL_SECRET?.trim() ||
    ""
  );
}

export function assertPoolContributeAuth(header: string | null): boolean {
  const expected = getPoolContributeSecret();
  if (!expected) return true;
  return header === expected;
}

export function assertPoolReadAuth(header: string | null): boolean {
  const expected = getPoolReadSecret();
  if (!expected) return false;
  return header === expected;
}
