import fs from "fs";
import path from "path";
import { isWebsiteApp } from "./app-mode";
import {
  isPoolEncryptionEnabled,
  openPoolSecret,
  sealPoolSecret,
} from "./session-pool-crypto";

export interface PooledSession {
  authorization: string;
  entitlements_jwt: string;
  client_version: string;
  client_platform: string;
  contributed_at: string;
  contributor_id?: string;
}

interface StoredSession {
  contributed_at: string;
  contributor_id?: string;
  /** v2：加密 blob；v1 兼容：明文 authorization / entitlements_jwt */
  sealed?: string;
  authorization?: string;
  entitlements_jwt?: string;
  client_version?: string;
  client_platform?: string;
}

interface PoolFile {
  version?: number;
  sessions: StoredSession[];
}

const DEFAULT_CLIENT_VERSION = "release-china-12.11-shipping-12-4815700";
const DEFAULT_CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

const MAX_POOL_SIZE = 32;

function poolFilePath(): string {
  const custom = process.env.SESSION_POOL_FILE?.trim();
  if (custom) return custom;
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "session-pool.json");
}

function stripBearer(value: string): string {
  const t = value.trim();
  return t.startsWith("Bearer ") ? t.slice(7).trim() : t;
}

function sealSessionPayload(session: PooledSession): StoredSession {
  const payload = JSON.stringify({
    authorization: session.authorization,
    entitlements_jwt: session.entitlements_jwt,
    client_version: session.client_version,
    client_platform: session.client_platform,
  });

  if (isWebsiteApp() && !isPoolEncryptionEnabled()) {
    throw new Error("pool_encryption_required_on_website");
  }

  if (isPoolEncryptionEnabled()) {
    return {
      contributed_at: session.contributed_at,
      contributor_id: session.contributor_id,
      sealed: sealPoolSecret(payload),
    };
  }

  return {
    contributed_at: session.contributed_at,
    contributor_id: session.contributor_id,
    authorization: session.authorization,
    entitlements_jwt: session.entitlements_jwt,
    client_version: session.client_version,
    client_platform: session.client_platform,
  };
}

function openStoredSession(stored: StoredSession): PooledSession | null {
  if (stored.sealed) {
    const raw = openPoolSecret(stored.sealed);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as Partial<PooledSession>;
      const access = String(data.authorization || "").trim();
      const entitlements = String(data.entitlements_jwt || "").trim();
      if (!access || !entitlements) return null;
      return {
        authorization: access.startsWith("Bearer ")
          ? access
          : `Bearer ${access}`,
        entitlements_jwt: entitlements,
        client_version:
          String(data.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
        client_platform:
          String(data.client_platform || "").trim() || DEFAULT_CLIENT_PLATFORM,
        contributed_at: stored.contributed_at,
        contributor_id: stored.contributor_id,
      };
    } catch {
      return null;
    }
  }

  const access = String(stored.authorization || "").trim();
  const entitlements = String(stored.entitlements_jwt || "").trim();
  if (!access || !entitlements) return null;

  return {
    authorization: access.startsWith("Bearer ") ? access : `Bearer ${access}`,
    entitlements_jwt: entitlements,
    client_version:
      String(stored.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
    client_platform:
      String(stored.client_platform || "").trim() || DEFAULT_CLIENT_PLATFORM,
    contributed_at: stored.contributed_at,
    contributor_id: stored.contributor_id,
  };
}

function readPoolRaw(): PoolFile {
  const filePath = poolFilePath();
  try {
    if (!fs.existsSync(filePath)) return { version: 2, sessions: [] };
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as PoolFile;
    return { sessions: Array.isArray(data.sessions) ? data.sessions : [] };
  } catch {
    return { version: 2, sessions: [] };
  }
}

function writePoolRaw(sessions: StoredSession[]) {
  const filePath = poolFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(
    tmp,
    `${JSON.stringify({ version: 2, sessions }, null, 2)}\n`,
    "utf8",
  );
  fs.renameSync(tmp, filePath);
}

function readPool(): PooledSession[] {
  return readPoolRaw()
    .sessions.map(openStoredSession)
    .filter((s): s is PooledSession => s !== null);
}

function writePool(sessions: PooledSession[]) {
  const stored = sessions.map(sealSessionPayload);
  writePoolRaw(stored);
}

export function contributeSession(input: {
  access_token: string;
  entitlements_jwt: string;
  client_version?: string;
  client_platform?: string;
  contributor_id?: string;
}): PooledSession {
  const access = stripBearer(input.access_token);
  const entitlements = stripBearer(input.entitlements_jwt);
  if (!access || !entitlements) {
    throw new Error("invalid_session");
  }

  const entry: PooledSession = {
    authorization: `Bearer ${access}`,
    entitlements_jwt: entitlements,
    client_version: input.client_version?.trim() || DEFAULT_CLIENT_VERSION,
    client_platform: input.client_platform?.trim() || DEFAULT_CLIENT_PLATFORM,
    contributed_at: new Date().toISOString(),
    contributor_id: input.contributor_id?.trim() || undefined,
  };

  const pool = readPool();
  const fingerprint = `${access.slice(0, 32)}|${entitlements.slice(0, 32)}`;
  const next = pool.filter(
    (s) =>
      `${stripBearer(s.authorization).slice(0, 32)}|${s.entitlements_jwt.slice(0, 32)}` !==
      fingerprint,
  );
  next.unshift(entry);
  writePool(next.slice(0, MAX_POOL_SIZE));
  return entry;
}

export function getLatestPooledSession(): PooledSession | null {
  const pool = readPool();
  if (!pool.length) return null;

  const maxAgeMs = 55 * 60_000;
  for (const s of pool) {
    const age = Date.now() - new Date(s.contributed_at).getTime();
    if (age <= maxAgeMs) return s;
  }
  return null;
}

export function removeLatestPooledSession(): boolean {
  const pool = readPool();
  if (!pool.length) return false;
  writePool(pool.slice(1));
  return true;
}

export function getPoolStats() {
  const pool = readPool();
  const latest = pool[0];
  return {
    total: pool.length,
    latest_at: latest?.contributed_at || null,
    encrypted: isPoolEncryptionEnabled(),
  };
}

export function toRiotSessionResponse(entry: PooledSession) {
  return {
    session: {
      authorization: entry.authorization,
      entitlements_jwt: entry.entitlements_jwt,
      client_version: entry.client_version,
      client_platform: entry.client_platform,
    },
  };
}

/** 将旧版明文池文件迁移为加密格式（需已配置 SESSION_POOL_ENCRYPTION_KEY） */
export function migratePoolToEncrypted(): { migrated: number } {
  const raw = readPoolRaw();
  const opened = raw.sessions
    .map(openStoredSession)
    .filter((s): s is PooledSession => s !== null);
  writePool(opened);
  return { migrated: opened.length };
}
