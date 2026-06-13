import fs from "fs";
import path from "path";

export type CachedLivePhase = "pregame" | "ingame";

export interface LiveMatchCacheEntry {
  updated_at: string;
  phase: CachedLivePhase;
  match_id: string;
  host?: string;
  url?: string;
  body: Record<string, unknown>;
}

const CACHE_TTL_MS = 90_000;

function cacheFilePath(): string {
  return path.join(
    process.env.LOCALAPPDATA ||
      path.join(process.env.USERPROFILE || "", "AppData", "Local"),
    "VAL-CN",
    "live-match.json",
  );
}

function cacheDir(): string {
  return path.dirname(cacheFilePath());
}

/** 读取缓存（忽略 TTL，用于合并更全的对局快照） */
export function readLiveMatchCacheRaw(): LiveMatchCacheEntry | null {
  try {
    const raw = fs.readFileSync(cacheFilePath(), "utf8");
    const data = JSON.parse(raw) as LiveMatchCacheEntry;
    if (!data?.body) return null;
    return data;
  } catch {
    return null;
  }
}

/** 从 Companion 快照目录找同一 match 玩家最多的一份 JSON */
export function readRichestCompanionSnapshot(
  matchId: string,
): Record<string, unknown> | null {
  if (!matchId) return null;

  const snapshotDir = path.join(cacheDir(), "live-snapshots");
  let best: Record<string, unknown> | null = null;
  let bestCount = 0;

  const consider = (body: Record<string, unknown> | undefined) => {
    if (!body) return;
    const count = countPlayersInMatchBody(body);
    if (count > bestCount) {
      bestCount = count;
      best = body;
    }
  };

  consider(readLiveMatchCacheRaw()?.body);

  try {
    if (!fs.existsSync(snapshotDir)) return best;
    for (const name of fs.readdirSync(snapshotDir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const doc = JSON.parse(
          fs.readFileSync(path.join(snapshotDir, name), "utf8"),
        ) as { match_id?: string; body?: Record<string, unknown> };
        if (String(doc.match_id || "") !== matchId) continue;
        consider(doc.body);
      } catch {
        // skip
      }
    }
  } catch {
    // ignore
  }

  return best;
}

function countPlayersInMatchBody(body: Record<string, unknown>): number {
  const direct = body.Players || body.players;
  if (Array.isArray(direct) && direct.length) return direct.length;

  let count = 0;
  const teams = body.Teams || body.teams;
  if (Array.isArray(teams)) {
    for (const team of teams) {
      const t = team as Record<string, unknown>;
      count += ((t.Players || t.players || []) as unknown[]).length;
    }
    if (count) return count;
  }

  for (const key of ["AllyTeam", "EnemyTeam", "allyTeam", "enemyTeam"]) {
    const team = body[key] as Record<string, unknown> | undefined;
    if (team) {
      count += ((team.Players || team.players || []) as unknown[]).length;
    }
  }
  return count;
}

/** Companion MITM 写入的对局缓存（兜底） */
export function readLiveMatchCache(): LiveMatchCacheEntry | null {
  const filePath = cacheFilePath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as LiveMatchCacheEntry;
    if (!data?.body || !data.updated_at) return null;
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function getLiveMatchCachePath(): string {
  return cacheFilePath();
}

export function isLiveMatchCacheFresh(entry: LiveMatchCacheEntry | null): boolean {
  if (!entry?.updated_at) return false;
  return Date.now() - new Date(entry.updated_at).getTime() <= CACHE_TTL_MS;
}

/** 对局结束或离开选人/局内时清除 Companion 缓存，避免认人页残留 */
export function clearLiveMatchCache(): boolean {
  try {
    const filePath = cacheFilePath();
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
