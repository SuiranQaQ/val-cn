/**
 * 国服无畏契约 Riot 会话管理
 *
 * 官方 API 必须带以下 Header 才能调用：
 * - Authorization: Bearer <access_token>
 * - X-Riot-Entitlements-JWT: <entitlements_jwt>
 * - X-Riot-ClientVersion: release-china-...
 * - X-Riot-ClientPlatform: <base64 JSON>
 *
 * 获取方式（按优先级自动尝试）：
 *
 * 官网 (website)：
 * 1. .env 手动填写（运维覆盖）
 * 2. 本站公用 Token 池
 * 3. 公开后备（valcn 等）
 *
 * 客户端 (client)：
 * 1. .env → session.json → 公用池 → 公开后备 → lockfile
 */

import fs from "fs";
import path from "path";
import { localRiotFetch, readLockfile } from "./riot-lockfile";
import { isWebsiteApp } from "./app-mode";
import { isValcnFallbackEnabled, VALCN_BASE } from "./valcn-fallback";
import { getLatestPooledSession, toRiotSessionResponse } from "./session-pool";

export interface RiotSession {
  authorization: string;
  entitlements_jwt: string;
  client_version: string;
  client_platform: string;
}

const DEFAULT_CLIENT_VERSION = "release-china-12.11-shipping-12-4815700";
const DEFAULT_CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

export type SessionSource = "env" | "file" | "pool" | "fallback" | "lockfile" | "none";

const DEFAULT_SESSION_FILE = path.join(
  process.env.LOCALAPPDATA || process.env.HOME || "",
  "VAL-CN",
  "session.json",
);

let cached: {
  value: RiotSession | null;
  fetchedAt: number;
  source: SessionSource;
} = {
  value: null,
  fetchedAt: 0,
  source: "none",
};

function getSessionFilePath(): string {
  return process.env.RIOT_SESSION_FILE?.trim() || DEFAULT_SESSION_FILE;
}

let fileSessionBlockedUntil = 0;

function looksLikeJwt(value: string): boolean {
  const t = value.replace(/^Bearer\s+/i, "").trim();
  return t.startsWith("eyJ") && t.split(".").length === 3;
}

function sessionFromFile(ignoreBlock = false): RiotSession | null {
  if (!ignoreBlock && Date.now() < fileSessionBlockedUntil) return null;

  const filePath = getSessionFilePath();
  if (!filePath) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as Record<string, string>;
    const access =
      data.access_token?.trim() ||
      data.accessToken?.trim() ||
      data.authorization?.trim() ||
      "";
    const entitlements =
      data.entitlements_jwt?.trim() ||
      data.entitlementsJwt?.trim() ||
      data.token?.trim() ||
      "";
    if (!access || !entitlements) return null;
    if (!looksLikeJwt(access) || !looksLikeJwt(entitlements)) return null;

    const updatedAt = data.updated_at?.trim();
    if (updatedAt) {
      const ageMs = Date.now() - new Date(updatedAt).getTime();
      if (ageMs > 55 * 60_000) return null;
    }

    const authorization = access.startsWith("Bearer ") ? access : `Bearer ${access}`;

    return {
      authorization,
      entitlements_jwt: entitlements,
      client_version:
        data.client_version?.trim() ||
        data.clientVersion?.trim() ||
        DEFAULT_CLIENT_VERSION,
      client_platform:
        data.client_platform?.trim() ||
        data.clientPlatform?.trim() ||
        DEFAULT_CLIENT_PLATFORM,
    };
  } catch {
    return null;
  }
}

function sessionFromEnv(): RiotSession | null {
  const token = process.env.RIOT_ACCESS_TOKEN?.trim();
  const entitlements = process.env.RIOT_ENTITLEMENTS_JWT?.trim();
  if (!token || !entitlements) return null;

  const authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  return {
    authorization,
    entitlements_jwt: entitlements,
    client_version: process.env.RIOT_CLIENT_VERSION?.trim() || DEFAULT_CLIENT_VERSION,
    client_platform:
      process.env.RIOT_CLIENT_PLATFORM?.trim() || DEFAULT_CLIENT_PLATFORM,
  };
}

/** 通过本机 Riot Client 本地 API 获取 token（客户端必须正在运行） */
async function sessionFromLockfile(): Promise<RiotSession | null> {
  const lock = await readLockfile();
  if (!lock) return null;

  try {
    const entRes = await localRiotFetch(lock, "/entitlements/v1/token");
    if (!entRes.ok) return null;

    const entData = await entRes.json();
    const accessToken = String(entData?.accessToken || "").trim();
    const entitlementsToken = String(entData?.token || "").trim();
    if (!accessToken || !entitlementsToken) return null;

    let clientVersion = DEFAULT_CLIENT_VERSION;
    try {
      const verRes = await localRiotFetch(
        lock,
        "/product-session/v1/external-sessions",
      );
      if (verRes.ok) {
        const sessions = await verRes.json();
        const valorant = Object.values(sessions || {}).find(
          (s: unknown) =>
            typeof s === "object" &&
            s !== null &&
            String((s as Record<string, string>).productId || "").includes(
              "valorant",
            ),
        ) as Record<string, string> | undefined;
        if (valorant?.version) clientVersion = valorant.version;
      }
    } catch {
      // use default
    }

    return {
      authorization: `Bearer ${accessToken}`,
      entitlements_jwt: entitlementsToken,
      client_version: clientVersion,
      client_platform: DEFAULT_CLIENT_PLATFORM,
    };
  } catch {
    return null;
  }
}

/** 本站公用池（老好人模式贡献） */
async function sessionFromSelfPool(): Promise<RiotSession | null> {
  const local = getLatestPooledSession();
  if (local) {
    const data = toRiotSessionResponse(local).session;
    return {
      authorization: data.authorization,
      entitlements_jwt: data.entitlements_jwt,
      client_version: data.client_version,
      client_platform: data.client_platform,
    };
  }

  const url = process.env.RIOT_SESSION_URL?.trim();
  if (!url) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const session = data?.session;
    if (!session?.authorization || !session?.entitlements_jwt) return null;
    return {
      authorization: String(session.authorization),
      entitlements_jwt: String(session.entitlements_jwt),
      client_version:
        String(session.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
      client_platform:
        String(session.client_platform || "").trim() || DEFAULT_CLIENT_PLATFORM,
    };
  } catch {
    return null;
  }
}

/** 临时借用外部公开会话 */
async function sessionFromValcnProxy(): Promise<RiotSession | null> {
  if (!isValcnFallbackEnabled()) return null;

  const url =
    process.env.VALCN_FALLBACK_URL?.trim() ||
    `${VALCN_BASE}/api/session/latest`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const session = data?.session;
    if (!session?.authorization || !session?.entitlements_jwt) return null;

    return {
      authorization: String(session.authorization),
      entitlements_jwt: String(session.entitlements_jwt),
      client_version:
        String(session.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
      client_platform:
        String(session.client_platform || "").trim() || DEFAULT_CLIENT_PLATFORM,
    };
  } catch {
    return null;
  }
}

export async function getRiotSession(): Promise<RiotSession | null> {
  if (cached.value && Date.now() - cached.fetchedAt < 30_000) {
    return cached.value;
  }

  let session: RiotSession | null = sessionFromEnv();
  let source: SessionSource = session ? "env" : "none";

  if (!session && !isWebsiteApp()) {
    session = sessionFromFile();
    if (session) source = "file";
  }

  if (!session) {
    session = await sessionFromSelfPool();
    if (session) source = "pool";
  }

  if (!session) {
    session = await sessionFromValcnProxy();
    if (session) source = "fallback";
  }

  if (!session && !isWebsiteApp()) {
    session = await sessionFromLockfile();
    if (session) source = "lockfile";
  }

  if (session) {
    cached = { value: session, fetchedAt: Date.now(), source };
  } else {
    cached = { value: null, fetchedAt: 0, source: "none" };
  }

  return session;
}

export function getCachedSessionSource(): SessionSource {
  return cached.source;
}

export function getSessionSource(): SessionSource {
  if (sessionFromEnv()) return "env";
  if (!isWebsiteApp() && sessionFromFile()) return "file";
  if (cached.source !== "none") return cached.source;
  return "none";
}

export function getCompanionFileSession(): RiotSession | null {
  if (isWebsiteApp()) return null;
  return sessionFromFile(true);
}

export function getSessionFilePathForDiagnostics(): string {
  return getSessionFilePath();
}

export function clearSessionCache() {
  cached = { value: null, fetchedAt: 0, source: "none" };
}

/** 本机 session 文件 Token 无效时临时跳过，自动改用公用池/公开后备 */
export function invalidateFileSession(blockMs = 90_000) {
  fileSessionBlockedUntil = Date.now() + blockMs;
  clearSessionCache();
}
