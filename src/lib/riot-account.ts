import type { RiotSession } from "./riot-session";
import { getCompanionFileSession, getRiotSession } from "./riot-session";
import { localRiotFetch, readLockfile } from "./riot-lockfile";

const PD_BASE =
  process.env.RIOT_PD_BASE?.trim() ||
  "https://alpha1-pd-redge.val.qq.com";

const SHARED_BASES = [
  process.env.RIOT_SHARED_BASE?.trim(),
  "https://alpha1-shared-redge.val.qq.com",
  "https://shared.val.qq.com",
].filter(Boolean) as string[];

export interface AccountMe {
  subject: string;
  game_name: string;
  tag_line: string;
  display_name: string;
}

function accountHeaders(session: RiotSession): HeadersInit {
  return {
    Authorization: session.authorization,
    "X-Riot-Entitlements-JWT": session.entitlements_jwt,
    "X-Riot-ClientVersion": session.client_version,
    "X-Riot-ClientPlatform": session.client_platform,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const raw = token.replace(/^Bearer\s+/i, "").trim();
  const parts = raw.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function subjectFromSession(session: RiotSession): string | null {
  const payload = decodeJwtPayload(session.authorization);
  const sub = String(payload?.sub || payload?.puuid || "").trim();
  return sub || null;
}

export function getSessionSubject(session: RiotSession | null): string | null {
  if (!session) return null;
  return subjectFromSession(session);
}

/** 只读拉取昵称，失败时不 invalidate 本机 session 文件 */
async function fetchPlayerNamesSoft(
  session: RiotSession,
  subjects: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))];
  const result = new Map<string, string>();
  if (!ids.length) return result;

  try {
    const res = await fetch(`${PD_BASE}/name-service/v2/players`, {
      method: "PUT",
      headers: accountHeaders(session),
      body: JSON.stringify(ids),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return result;

    const data = await res.json();
    if (!Array.isArray(data)) return result;

    for (const p of data) {
      const subject = String(p?.Subject || p?.subject || "").trim();
      const name = String(p?.GameName || p?.gameName || "").trim();
      const tag = String(p?.TagLine || p?.tagLine || "").trim();
      if (subject && name) result.set(subject, tag ? `${name}#${tag}` : name);
    }
  } catch {
    // ignore
  }

  return result;
}

function parseAccountPayload(data: Record<string, unknown>): AccountMe | null {
  const subject = String(data.puuid || data.subject || "").trim();
  const game_name = String(data.gameName || data.game_name || "").trim();
  const tag_line = String(data.tagLine || data.tag_line || "").trim();
  if (!subject || !game_name || !tag_line) return null;
  return {
    subject,
    game_name,
    tag_line,
    display_name: `${game_name}#${tag_line}`,
  };
}

async function fetchAccountMeViaShared(
  session: RiotSession,
): Promise<AccountMe | null> {
  for (const base of SHARED_BASES) {
    try {
      const res = await fetch(`${base}/riot/account/v1/accounts/me`, {
        headers: accountHeaders(session),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      const me = parseAccountPayload(data);
      if (me) return me;
    } catch {
      // try next base
    }
  }
  return null;
}

async function fetchAccountMeViaLockfile(): Promise<AccountMe | null> {
  const lock = await readLockfile();
  if (!lock) return null;

  try {
    const res = await localRiotFetch(lock, "/chat/v1/session");
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;

    const subject = String(data.puuid || data.Puuid || data.subject || "").trim();
    const game_name = String(
      data.game_name || data.gameName || data.GameName || "",
    ).trim();
    const tag_line = String(
      data.game_tag || data.gameTag || data.TagLine || data.tagLine || "",
    ).trim();

    if (subject && game_name && tag_line) {
      return {
        subject,
        game_name,
        tag_line,
        display_name: `${game_name}#${tag_line}`,
      };
    }

    if (subject) {
      const session = getCompanionFileSession() || (await getRiotSession());
      const names = session
        ? await fetchPlayerNamesSoft(session, [subject])
        : new Map<string, string>();
      const display = names.get(subject);
      if (display?.includes("#")) {
        const [gn, tg] = display.split("#");
        if (gn && tg) {
          return {
            subject,
            game_name: gn,
            tag_line: tg,
            display_name: display,
          };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchAccountMeViaNameService(
  session: RiotSession,
): Promise<AccountMe | null> {
  const subject = subjectFromSession(session);
  if (!subject) return null;

  const names = await fetchPlayerNamesSoft(session, [subject]);
  const display = names.get(subject);
  if (!display?.includes("#")) return null;

  const [game_name, tag_line] = display.split("#");
  if (!game_name || !tag_line) return null;

  return {
    subject,
    game_name,
    tag_line,
    display_name: display,
  };
}

/** 用当前 Token 拉取本账号 Riot ID（多路后备） */
export async function fetchAccountMe(): Promise<AccountMe | null> {
  const session = getCompanionFileSession() || (await getRiotSession());
  if (!session) return null;

  const shared = await fetchAccountMeViaShared(session);
  if (shared) return shared;

  const lockfile = await fetchAccountMeViaLockfile();
  if (lockfile) return lockfile;

  return fetchAccountMeViaNameService(session);
}
