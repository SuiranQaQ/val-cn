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
 * 1. .env.local 手动填写
 * 2. 本机 Riot Client lockfile（客户端在运行）
 * 3. 仅当设置 RIOT_SESSION_URL 时才走外部会话（默认不用 valcn）
 */

import { localRiotFetch, readLockfile } from "./riot-lockfile";
import { isValcnFallbackEnabled, VALCN_BASE } from "./valcn-fallback";

export interface RiotSession {
  authorization: string;
  entitlements_jwt: string;
  client_version: string;
  client_platform: string;
}

const DEFAULT_CLIENT_VERSION = "release-china-12.11-shipping-12-4815700";
const DEFAULT_CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

export type SessionSource = "env" | "lockfile" | "valcn" | "none";

let cached: {
  value: RiotSession | null;
  fetchedAt: number;
  source: SessionSource;
} = {
  value: null,
  fetchedAt: 0,
  source: "none",
};

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

/** 临时借用 valcn 公开会话 */
async function sessionFromValcnProxy(): Promise<RiotSession | null> {
  if (!isValcnFallbackEnabled()) return null;

  const url =
    process.env.RIOT_SESSION_URL?.trim() ||
    `${VALCN_BASE}/api/session/latest`;

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

export async function getRiotSession(): Promise<RiotSession | null> {
  if (cached.value && Date.now() - cached.fetchedAt < 30_000) {
    return cached.value;
  }

  let session: RiotSession | null = sessionFromEnv();
  let source: SessionSource = session ? "env" : "none";

  if (!session) {
    session = await sessionFromLockfile();
    if (session) source = "lockfile";
  }

  if (!session) {
    session = await sessionFromValcnProxy();
    if (session) source = "valcn";
  }

  if (session) {
    cached = { value: session, fetchedAt: Date.now(), source };
  } else {
    cached = { value: null, fetchedAt: 0, source: "none" };
  }

  return session;
}

export function getSessionSource(): SessionSource {
  if (sessionFromEnv()) return "env";
  return cached.source;
}

export function clearSessionCache() {
  cached = { value: null, fetchedAt: 0, source: "none" };
}
