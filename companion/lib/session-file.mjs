import fs from "fs";
import { APP_DIR, SESSION_FILE } from "./paths.mjs";

const DEFAULT_CLIENT_VERSION = "release-china-12.11-shipping-12-4815700";
const DEFAULT_CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

let lastWriteAt = 0;
let lastFingerprint = "";

function stripBearer(value) {
  const t = String(value || "").trim();
  if (!t) return "";
  return t.startsWith("Bearer ") ? t.slice(7).trim() : t;
}

function fingerprint(access, entitlements) {
  return `${access.slice(0, 24)}|${entitlements.slice(0, 24)}`;
}

function jwtExpMs(token) {
  const t = stripBearer(token);
  const parts = t.split(".");
  if (parts.length < 2) return 0;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function readExistingAccessExp() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw);
    const access =
      data.access_token || data.accessToken || data.authorization || "";
    return jwtExpMs(access);
  } catch {
    return 0;
  }
}

/**
 * @param {{
 *   access_token?: string;
 *   entitlements_jwt?: string;
 *   client_version?: string;
 *   client_platform?: string;
 * }} partial
 */
export function writeSession(partial) {
  const access = stripBearer(partial.access_token);
  const entitlements = stripBearer(partial.entitlements_jwt);
  if (!access || !entitlements) return false;

  const fp = fingerprint(access, entitlements);
  const now = Date.now();
  const newExp = jwtExpMs(access);
  const oldExp = readExistingAccessExp();
  const fresherToken = newExp > oldExp + 30_000;

  if (fp === lastFingerprint && now - lastWriteAt < 5_000 && !fresherToken) {
    return false;
  }

  const payload = {
    access_token: access,
    entitlements_jwt: entitlements,
    client_version:
      String(partial.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
    client_platform:
      String(partial.client_platform || "").trim() || DEFAULT_CLIENT_PLATFORM,
    updated_at: new Date().toISOString(),
  };

  fs.mkdirSync(APP_DIR, { recursive: true });
  const tmp = `${SESSION_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, SESSION_FILE);

  lastFingerprint = fp;
  lastWriteAt = now;
  return true;
}

export function readSessionMeta() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      exists: true,
      updated_at: data.updated_at || null,
      client_version: data.client_version || null,
    };
  } catch {
    return { exists: false, updated_at: null, client_version: null };
  }
}
