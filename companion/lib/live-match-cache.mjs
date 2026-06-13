import fs from "fs";
import path from "path";
import { APP_DIR, ensureAppDir } from "./paths.mjs";

export const LIVE_MATCH_FILE = path.join(APP_DIR, "live-match.json");

function playerSubject(row) {
  return String(row?.Subject || row?.subject || "").trim();
}

function playerAgentId(row) {
  return String(
    row?.CharacterID ||
      row?.CharacterId ||
      row?.characterId ||
      row?.PickedCharacterID ||
      "",
  ).trim();
}

function mergePlayerRow(a, b) {
  const agent = playerAgentId(a) || playerAgentId(b);
  const stateA = String(a?.CharacterSelectionState || "").toLowerCase();
  const stateB = String(b?.CharacterSelectionState || "").toLowerCase();
  const rank = (s) =>
    s.includes("lock") ? 2 : s.includes("select") ? 1 : 0;
  const pickState = rank(stateA) >= rank(stateB) ? stateA : stateB;

  return {
    ...b,
    ...a,
    CharacterID: agent || a?.CharacterID || b?.CharacterID,
    CharacterSelectionState:
      pickState || a?.CharacterSelectionState || b?.CharacterSelectionState,
    CompetitiveTier: Math.max(
      Number(a?.CompetitiveTier || 0),
      Number(b?.CompetitiveTier || 0),
    ) || a?.CompetitiveTier || b?.CompetitiveTier,
    SeasonalBadgeInfo: a?.SeasonalBadgeInfo || b?.SeasonalBadgeInfo,
  };
}

function mergePlayerArrays(a, b) {
  const ar = Array.isArray(a) ? a : [];
  const br = Array.isArray(b) ? b : [];
  const bySubject = new Map();

  for (const row of [...br, ...ar]) {
    const subject = playerSubject(row);
    if (!subject) continue;
    const existing = bySubject.get(subject);
    bySubject.set(subject, existing ? mergePlayerRow(existing, row) : row);
  }
  return [...bySubject.values()];
}

function mergeTeamObject(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    ...b,
    ...a,
    Players: mergePlayerArrays(a.Players, b.Players),
  };
}

function mergeTeamArrays(a, b) {
  const ar = Array.isArray(a) ? a : [];
  const br = Array.isArray(b) ? b : [];
  if (!ar.length) return b;
  if (!br.length) return a;

  const byTeamId = new Map();
  for (const team of [...br, ...ar]) {
    const teamId = String(team?.TeamID || team?.teamId || "").trim();
    const key = teamId || `idx-${byTeamId.size}`;
    const existing = byTeamId.get(key);
    byTeamId.set(key, existing ? mergeTeamObject(existing, team) : team);
  }
  return [...byTeamId.values()];
}

export function mergeMatchBodies(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    ...b,
    ...a,
    Teams: mergeTeamArrays(a.Teams, b.Teams),
    AllyTeam: mergeTeamObject(a.AllyTeam, b.AllyTeam),
    EnemyTeam: mergeTeamObject(a.EnemyTeam, b.EnemyTeam),
    Players: mergePlayerArrays(a.Players, b.Players),
    EnemyTeamSize: Math.max(
      Number(a?.EnemyTeamSize || 0),
      Number(b?.EnemyTeamSize || 0),
    ) || a?.EnemyTeamSize || b?.EnemyTeamSize,
    PregameState: String(a?.PregameState || b?.PregameState || ""),
    State: a?.State || b?.State,
  };
}

function readExistingCache() {
  try {
    const raw = fs.readFileSync(LIVE_MATCH_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Companion 截获对局 JSON 后写入，供 VALBOX /live 兜底读取
 * 与已有缓存按玩家 subject 合并，避免新快照覆盖掉已 reveal 的敌方
 */
export function writeLiveMatchCache(payload) {
  if (!payload?.body || !payload.match_id || !payload.phase) return;

  ensureAppDir();

  const existing = readExistingCache();
  let body = payload.body;
  if (existing?.body && existing.match_id === payload.match_id) {
    body = mergeMatchBodies(existing.body, payload.body);
  }

  const doc = {
    updated_at: new Date().toISOString(),
    phase: payload.phase,
    match_id: payload.match_id,
    host: payload.host,
    url: payload.url,
    body,
  };

  const tmp = `${LIVE_MATCH_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, LIVE_MATCH_FILE);
}

/** 对局结束 / 离开对局时清除，避免 VALBOX 仍显示上一局认人 */
export function clearLiveMatchCache() {
  try {
    if (fs.existsSync(LIVE_MATCH_FILE)) {
      fs.unlinkSync(LIVE_MATCH_FILE);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
