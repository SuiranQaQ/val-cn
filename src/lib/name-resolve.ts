/**
 * Name#Tag → Subject (PUUID)
 *
 * 官方 pd 的 name-service 只能 UUID→名字，不能反查。
 * 解析优先级：
 * 1. 本机客户端好友接口（需瓦罗兰特在运行）
 * 2. Riot shared account 接口（需有效 Token）
 * 3. valcn 名字队列：先 enqueue 再轮询 status（默认可用）
 */

import { getRiotSession } from "./riot-session";
import { localRiotFetch, readLockfile } from "./riot-lockfile";
import { isValcnFallbackEnabled, VALCN_BASE } from "./valcn-fallback";

export type NameResolveSource =
  | "local_client"
  | "riot_account"
  | "external"
  | "none";

let lastSource: NameResolveSource = "none";
let lastResolveDetail = "";

export function getLastNameResolveSource(): NameResolveSource {
  return lastSource;
}

export function getLastNameResolveDetail(): string {
  return lastResolveDetail;
}

export async function hasLockfile(): Promise<boolean> {
  return (await readLockfile()) !== null;
}

/** 规范化用户输入：全角 #、多余空格 */
export function normalizeNameTag(nameTag: string): string {
  return nameTag
    .trim()
    .replace(/\uFF03/g, "#")
    .replace(/\s+#\s+/, "#");
}

function splitNameTag(nameTag: string): { gameName: string; tagLine: string } | null {
  const trimmed = normalizeNameTag(nameTag);
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim(),
  };
}

function matchPlayer(
  r: Record<string, unknown>,
  gameName: string,
  tagLine: string,
): string | null {
  const gn = String(r.game_name || r.gameName || r.GameName || "").trim();
  const tg = String(r.game_tag || r.gameTag || r.TagLine || "").trim();
  const id = String(r.puuid || r.Puuid || r.subject || r.Subject || "").trim();
  if (
    id &&
    gn.toLowerCase() === gameName.toLowerCase() &&
    tg.toLowerCase() === tagLine.toLowerCase()
  ) {
    return id;
  }
  return null;
}

async function resolveViaLocalClient(
  gameName: string,
  tagLine: string,
): Promise<string | null> {
  const lock = await readLockfile();
  if (!lock) return null;

  const friendsRes = await localRiotFetch(lock, "/chat/v4/friends");
  if (friendsRes.ok) {
    const friendsData = (await friendsRes.json()) as {
      friends?: Array<Record<string, unknown>>;
    };
    for (const f of friendsData.friends || []) {
      const id = matchPlayer(f, gameName, tagLine);
      if (id) return id;
    }
  }

  const bodies = [
    JSON.stringify({ game_name: gameName, game_tag: tagLine }),
    JSON.stringify({ gameName, tagLine }),
  ];

  for (const body of bodies) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const sendRes = await localRiotFetch(lock, "/chat/v4/friendrequests", {
        method: "POST",
        body,
      });
      if (!sendRes.ok && sendRes.status !== 409) continue;

      await new Promise((r) => setTimeout(r, 500 + attempt * 300));

      const listRes = await localRiotFetch(lock, "/chat/v4/friendrequests");
      if (!listRes.ok) continue;

      const data = (await listRes.json()) as {
        requests?: Array<Record<string, unknown>>;
      };

      for (const req of data.requests || []) {
        const id = matchPlayer(req, gameName, tagLine);
        if (!id) continue;

        const sub = String(req.subscription || "");
        if (sub === "pending_out") {
          await localRiotFetch(
            lock,
            `/chat/v4/friendrequests?puuid=${encodeURIComponent(id)}`,
            { method: "DELETE" },
          ).catch(() => null);
        }
        return id;
      }
    }
  }

  return null;
}

async function resolveViaRiotAccount(
  gameName: string,
  tagLine: string,
): Promise<string | null> {
  const session = await getRiotSession();
  if (!session) return null;

  const bases = [
    process.env.RIOT_SHARED_BASE?.trim(),
    "https://alpha1-shared-redge.val.qq.com",
    "https://shared.val.qq.com",
  ].filter(Boolean) as string[];

  const headers = {
    Authorization: session.authorization,
    "X-Riot-Entitlements-JWT": session.entitlements_jwt,
    "X-Riot-ClientVersion": session.client_version,
    "X-Riot-ClientPlatform": session.client_platform,
  };

  for (const base of bases) {
    try {
      const url = `${base}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) continue;

      const data = (await res.json()) as { puuid?: string; subject?: string };
      const id = String(data.puuid || data.subject || "").trim();
      if (id) return id;
    } catch {
      // try next base
    }
  }
  return null;
}

interface ValcnQueueStatus {
  status?: string;
  resolved_subject?: string;
  queue_id?: string | null;
}

async function fetchValcnQueueStatus(
  nameTag: string,
): Promise<ValcnQueueStatus | null> {
  const params = new URLSearchParams({ full_name: nameTag.trim() });
  try {
    const res = await fetch(
      `${VALCN_BASE}/api/name_resolve_queue/status?${params}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as ValcnQueueStatus;
  } catch {
    return null;
  }
}

async function enqueueValcnName(nameTag: string): Promise<boolean> {
  try {
    const res = await fetch(`${VALCN_BASE}/api/name_resolve_queue/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ full_name: nameTag.trim() }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** valcn：先查缓存 → enqueue → 轮询（新 ID 必须走队列） */
async function resolveViaValcnNameQueue(nameTag: string): Promise<{
  subject: string | null;
  status: string;
}> {
  if (!isValcnFallbackEnabled()) {
    return { subject: null, status: "disabled" };
  }

  const trimmed = nameTag.trim();

  let status = await fetchValcnQueueStatus(trimmed);
  if (status?.status === "resolved" && status.resolved_subject) {
    return { subject: status.resolved_subject.trim(), status: "resolved" };
  }

  // valcn 对未入队名字也会返回 unknown，不能在此直接判定玩家不存在
  const needsEnqueue = status?.status !== "pending";
  if (needsEnqueue) {
    const enqueued = await enqueueValcnName(trimmed);
    if (!enqueued) {
      return { subject: null, status: "enqueue_failed" };
    }
  }

  const maxAttempts = 24;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500));
    status = await fetchValcnQueueStatus(trimmed);
    if (!status) continue;

    if (status.status === "resolved" && status.resolved_subject) {
      return { subject: status.resolved_subject.trim(), status: "resolved" };
    }
    // unknown 仅在接受队列处理后再视为不存在
    if (status.status === "unknown") {
      return { subject: null, status: "unknown" };
    }
    if (status.status === "failed" || status.status === "error") {
      return { subject: null, status: status.status };
    }
  }

  return { subject: null, status: "timeout" };
}

export async function resolveNameTagToSubject(
  nameTag: string,
): Promise<string | null> {
  try {
    return await resolveNameTagToSubjectOrThrow(nameTag);
  } catch {
    return null;
  }
}

export async function resolveNameTagToSubjectOrThrow(
  nameTag: string,
): Promise<string> {
  const parts = splitNameTag(nameTag);
  if (!parts) throw new Error("invalid_format");

  const normalized = normalizeNameTag(nameTag);
  const { gameName, tagLine } = parts;
  const lock = await readLockfile();
  const session = await getRiotSession();

  const local = await resolveViaLocalClient(gameName, tagLine);
  if (local) {
    lastSource = "local_client";
    lastResolveDetail = "本机客户端好友接口";
    return local;
  }

  // 国服 shared account 对中文名常返回错误 UUID，中文 ID 直接走 valcn 队列
  const asciiOnly = /^[\x00-\x7F]+$/.test(gameName) && /^[\x00-\x7F]+$/.test(tagLine);
  const account = asciiOnly
    ? await resolveViaRiotAccount(gameName, tagLine)
    : null;
  if (account) {
    lastSource = "riot_account";
    lastResolveDetail = "Riot 账号接口";
    return account;
  }

  const valcn = await resolveViaValcnNameQueue(normalized);
  if (valcn.subject) {
    lastSource = "external";
    lastResolveDetail = "valcn 名字队列";
    return valcn.subject;
  }

  lastSource = "none";

  if (valcn.status === "unknown") {
    lastResolveDetail = "玩家不存在或 ID#编号 有误";
    throw new Error("player_not_found");
  }
  if (valcn.status === "timeout") {
    lastResolveDetail = "名字解析超时，请稍后重试或开启游戏客户端";
    throw new Error("name_resolve_timeout");
  }
  if (valcn.status === "disabled") {
    lastResolveDetail = "未开启 valcn 后备且本机无法解析";
  }

  if (!lock && !session) {
    lastResolveDetail = "无客户端也无 Token";
    throw new Error("client_not_running");
  }
  if (lock && !session) {
    lastResolveDetail = "客户端 Token 读取失败";
    throw new Error("session_from_lockfile_failed");
  }

  lastResolveDetail = `解析失败 (${valcn.status})`;
  throw new Error("name_resolve_failed");
}
