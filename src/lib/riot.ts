/**
 * 国服无畏契约官方内部 API 客户端
 * Base: https://alpha1-pd-redge.val.qq.com
 *
 * 与国际服 pd.{shard}.a.pvp.net 是同一套接口，只是域名不同。
 * 参考: https://valapidocs.techchrism.me/endpoint/match-details
 */

import {
  normalizeNameTag,
  resolveNameTagToSubjectOrThrow,
} from "./name-resolve";
import {
  clearSessionCache,
  getRiotSession,
  type RiotSession,
} from "./riot-session";

const PD_BASE =
  process.env.RIOT_PD_BASE?.trim() ||
  "https://alpha1-pd-redge.val.qq.com";

function riotHeaders(session: RiotSession): HeadersInit {
  return {
    Authorization: session.authorization,
    "X-Riot-Entitlements-JWT": session.entitlements_jwt,
    "X-Riot-ClientVersion": session.client_version,
    "X-Riot-ClientPlatform": session.client_platform,
    "Content-Type": "application/json",
  };
}

async function riotFetch(
  path: string,
  init?: RequestInit,
  retryOnAuth = true,
): Promise<Response> {
  const session = await getRiotSession();
  if (!session) throw new Error("riot_session_unavailable");

  const url = `${PD_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...riotHeaders(session), ...(init?.headers || {}) },
    cache: "no-store",
  });

  if (retryOnAuth && (res.status === 401 || res.status === 403)) {
    clearSessionCache();
    const retrySession = await getRiotSession();
    if (retrySession) {
      return fetch(url, {
        ...init,
        headers: { ...riotHeaders(retrySession), ...(init?.headers || {}) },
        cache: "no-store",
      });
    }
  }

  return res;
}

/**
 * 解析玩家 Subject (PUUID)
 * - 已是 UUID：直接返回
 * - Name#Tag：走名字解析服务（非 name-service）
 */
export async function resolvePlayerId(input: string): Promise<string> {
  const trimmed = normalizeNameTag(input);
  if (!trimmed) throw new Error("invalid_input");

  if (!trimmed.includes("#") && /^[0-9a-f-]{36}$/i.test(trimmed)) {
    return trimmed;
  }

  if (!trimmed.includes("#")) {
    throw new Error("invalid_format");
  }

  return resolveNameTagToSubjectOrThrow(trimmed);
}

/** 批量 UUID → Name#Tag（官方 name-service，仅支持 PUUID 入参） */
export async function resolvePlayerNames(
  subjects: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))];
  const result = new Map<string, string>();
  if (!ids.length) return result;

  const res = await riotFetch("/name-service/v2/players", {
    method: "PUT",
    body: JSON.stringify(ids),
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
  return result;
}

/** 比赛详情 */
export async function fetchMatchDetail(matchId: string) {
  const res = await riotFetch(
    `/match-details/v1/matches/${encodeURIComponent(matchId)}`,
  );
  if (!res.ok) throw new Error(`match_not_found:${res.status}`);
  return res.json();
}

/** 比赛历史 */
export async function fetchPlayerHistory(
  subject: string,
  startIndex = 0,
  endIndex = 10,
) {
  const res = await riotFetch(
    `/match-history/v1/history/${encodeURIComponent(subject)}?startIndex=${startIndex}&endIndex=${endIndex}`,
  );
  if (!res.ok) throw new Error(`history_not_found:${res.status}`);
  return res.json();
}

/** 竞技模式 MMR（含当前 Act 赛季 ID） */
export async function fetchPlayerMmr(subject: string) {
  const res = await riotFetch(
    `/mmr/v1/players/${encodeURIComponent(subject)}/competitiveupdates?startIndex=0&endIndex=1&queue=competitive`,
  );
  if (!res.ok) throw new Error(`mmr_not_found:${res.status}`);
  return res.json();
}

/** 账号等级与 XP（通常仅本人会话可查） */
export async function fetchAccountXp(subject: string) {
  const res = await riotFetch(
    `/account-xp/v1/players/${encodeURIComponent(subject)}`,
  );
  if (!res.ok) return null;
  return res.json();
}

/** 玩家当前配装/名片（通常仅本人可查；他人可从比赛详情 playerCard 字段获取） */
export async function fetchPlayerLoadout(subject: string) {
  const res = await riotFetch(
    `/personalization/v2/players/${encodeURIComponent(subject)}/playerloadout`,
  );
  if (!res.ok) return null;
  return res.json();
}

/** 匹配处罚 / 封禁记录（返回当前会话对应账号的处罚，非查询目标时请谨慎解读） */
export async function fetchPenalties() {
  const res = await riotFetch("/restrictions/v3/penalties");
  if (!res.ok) return null;
  return res.json();
}

/** 竞技模式段位变动记录 */
export async function fetchCompetitiveUpdates(subject: string, amount = 20) {
  const res = await riotFetch(
    `/mmr/v1/players/${encodeURIComponent(subject)}/competitiveupdates?startIndex=0&endIndex=${amount}&queue=competitive`,
  );
  if (!res.ok) throw new Error(`mmr_not_found:${res.status}`);
  return res.json();
}

const HISTORY_PAGE_SIZE = 20;

/** 拉取全部比赛 ID（分页，单次最多 20 场） */
export async function fetchAllMatchIds(subject: string): Promise<{
  match_ids: string[];
  total: number;
}> {
  const first = await fetchPlayerHistory(subject, 0, HISTORY_PAGE_SIZE);
  const total = Number(first?.Total || 0);
  const ids = ((first?.History || []) as Array<{ MatchID: string }>).map(
    (h) => h.MatchID,
  );

  let start = ids.length;
  while (start < total) {
    const end = Math.min(start + HISTORY_PAGE_SIZE, total);
    const page = await fetchPlayerHistory(subject, start, end);
    const more = ((page?.History || []) as Array<{ MatchID: string }>).map(
      (h) => h.MatchID,
    );
    for (const id of more) {
      if (!ids.includes(id)) ids.push(id);
    }
    if (!more.length) break;
    start = ids.length;
  }

  return { match_ids: ids, total: total || ids.length };
}

/** 玩家概览：历史 + 段位 */
export async function fetchPlayerOverview(nameTag: string) {
  const subject = await resolvePlayerId(nameTag);

  const [historyResult, updates] = await Promise.all([
    fetchAllMatchIds(subject),
    fetchCompetitiveUpdates(subject, 20).catch(() => null),
  ]);

  return {
    subject,
    player_name: nameTag,
    match_ids: historyResult.match_ids,
    match_history_total: historyResult.total,
    updates,
  };
}
