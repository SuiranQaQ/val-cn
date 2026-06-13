import type { RiotSession } from "./riot-session";
import { getCompanionFileSession } from "./riot-session";

const SHARED_BASE =
  process.env.RIOT_SHARED_BASE?.trim() ||
  "https://alpha1-shared-redge.val.qq.com";

const PROBE_OK_TTL_MS = 45_000;
const PROBE_FAIL_TTL_MS = 10_000;

let probeCache: { at: number; ok: boolean } | null = null;

function accountHeaders(session: RiotSession): HeadersInit {
  return {
    Authorization: session.authorization,
    "X-Riot-Entitlements-JWT": session.entitlements_jwt,
    "X-Riot-ClientVersion": session.client_version,
    "X-Riot-ClientPlatform": session.client_platform,
  };
}

function isTransientProbeStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function probeOnce(session: RiotSession): Promise<{ ok: boolean; transient: boolean }> {
  try {
    const res = await fetch(`${SHARED_BASE}/riot/account/v1/accounts/me`, {
      headers: accountHeaders(session),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return { ok: true, transient: false };
    if (isTransientProbeStatus(res.status)) {
      return { ok: false, transient: true };
    }
    return { ok: false, transient: false };
  } catch {
    return { ok: false, transient: true };
  }
}

/** 轻量探测：Token 是否仍能调官方 API（比 JWT exp 更可靠） */
export async function probeSessionWorks(
  session?: RiotSession | null,
): Promise<boolean> {
  if (probeCache) {
    const ttl = probeCache.ok ? PROBE_OK_TTL_MS : PROBE_FAIL_TTL_MS;
    if (Date.now() - probeCache.at < ttl) {
      return probeCache.ok;
    }
  }

  const active = session || getCompanionFileSession();
  if (!active) {
    probeCache = { at: Date.now(), ok: false };
    return false;
  }

  let result = await probeOnce(active);
  if (!result.ok && result.transient) {
    await new Promise((r) => setTimeout(r, 350));
    result = await probeOnce(active);
  }

  if (!result.ok && result.transient && probeCache?.ok) {
    probeCache = { at: Date.now(), ok: true };
    return true;
  }

  probeCache = { at: Date.now(), ok: result.ok };
  return result.ok;
}

export function clearSessionProbeCache() {
  probeCache = null;
}
