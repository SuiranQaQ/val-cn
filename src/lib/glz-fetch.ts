/**
 * 国服 GLZ 对局 API（pregame / core-game）
 * 与 pd-redge 共用同一套 JWT，域名不同。
 */

import {
  getCachedSessionSource,
  getRiotSession,
  invalidateFileSession,
  clearSessionCache,
  type RiotSession,
} from "./riot-session";
import { clearSessionProbeCache } from "./session-probe";
import { removeLatestPooledSession } from "./session-pool";

const GLZ_BASE =
  process.env.RIOT_GLZ_BASE?.trim() ||
  "https://alpha1-glz-redge.val.qq.com";

function glzHeaders(session: RiotSession): HeadersInit {
  return {
    Authorization: session.authorization,
    "X-Riot-Entitlements-JWT": session.entitlements_jwt,
    "X-Riot-ClientVersion": session.client_version,
    "X-Riot-ClientPlatform": session.client_platform,
    "Content-Type": "application/json",
  };
}

/** 调用 GLZ 对局接口（pregame / core-game） */
export async function glzFetch(
  path: string,
  init?: RequestInit,
  retryOnAuth = true,
): Promise<Response> {
  const session = await getRiotSession();
  if (!session) throw new Error("riot_session_unavailable");

  const activeSource = getCachedSessionSource();
  const url = `${GLZ_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...glzHeaders(session), ...(init?.headers || {}) },
    cache: "no-store",
  });

  if (retryOnAuth && (res.status === 401 || res.status === 403)) {
    if (activeSource === "file") {
      invalidateFileSession();
      clearSessionProbeCache();
    } else if (activeSource === "pool") {
      removeLatestPooledSession();
      clearSessionCache();
    } else {
      clearSessionCache();
    }
    const retrySession = await getRiotSession();
    if (retrySession) {
      return fetch(url, {
        ...init,
        headers: { ...glzHeaders(retrySession), ...(init?.headers || {}) },
        cache: "no-store",
      });
    }
  }

  return res;
}

export function getGlzBase(): string {
  return GLZ_BASE;
}
