/**
 * 本机对局认人：pregame（选人）/ core-game（局内）
 * 国际服：lockfile → 127.0.0.1
 * 国服：JWT → alpha1-glz-redge.val.qq.com（Companion 缓存兜底）
 */

import { subjectFromSession } from "./riot-account";
import { getAgentName, getMapName, getRankName } from "./constants";
import { glzFetch } from "./glz-fetch";
import {
  clearLiveMatchCache,
  isLiveMatchCacheFresh,
  readLiveMatchCache,
  readLiveMatchCacheRaw,
  readRichestCompanionSnapshot,
  type LiveMatchCacheEntry,
} from "./live-match-cache";
import { getRiotSession } from "./riot-session";
import { localRiotFetch, readLockfile, type LockfileInfo } from "./riot-lockfile";

export type LivePhase = "pregame" | "ingame" | "none";
export type LiveDataSource = "lockfile" | "glz" | "companion_cache";

/** 对局已结束 / 结算阶段，不再展示认人 */
const TERMINAL_MATCH_STATES = new Set([
  "POST_GAME",
  "COMPLETED",
  "FINISHED",
  "ENDED",
]);

export function isLiveMatchBodyActive(match: Record<string, unknown>): boolean {
  const state = String(match.State || match.state || "").toUpperCase();
  if (state && TERMINAL_MATCH_STATES.has(state)) return false;

  const pregameState = String(
    match.PregameState || match.pregameState || "",
  ).toLowerCase();
  if (
    pregameState.includes("finished") ||
    pregameState.includes("ended") ||
    pregameState.includes("complete")
  ) {
    return false;
  }

  return true;
}

function inactiveSnapshot(mySubject: string): LiveMatchSnapshot {
  clearLiveMatchCache();
  return emptySnapshot(mySubject);
}

export interface LivePartyGroup {
  party_id: string;
  party_index: number;
  size: number;
  subjects: string[];
  team_id: string;
  is_ally: boolean;
}

export type AgentSelectionState = "" | "selected" | "locked";

export interface LivePlayer {
  subject: string;
  team_id: string;
  party_id: string;
  party_size: number;
  party_index: number;
  agent_id: string;
  agent_name: string;
  agent_selection_state: AgentSelectionState;
  player_card_id: string;
  account_level: number;
  rank_tier: number;
  rank_name: string;
  is_me: boolean;
  is_ally: boolean;
  /** 由 live-visual-enrich 填充 */
  agent_icon?: string;
  player_card_art?: string;
  rank_icon?: string;
}

export interface LiveMatchSnapshot {
  active: boolean;
  phase: LivePhase;
  match_id: string;
  map_id: string;
  map_name: string;
  mode: string;
  state: string;
  my_subject: string;
  my_team_id: string;
  parties: LivePartyGroup[];
  players: LivePlayer[];
  /** 对面尚未 reveal 的人数（pregame API） */
  enemy_pending_count: number;
  pregame_state: string;
}

function playerSubject(row: Record<string, unknown>): string {
  return String(row.Subject || row.subject || "").trim();
}

function addTeamPlayers(
  bySubject: Map<string, Record<string, unknown>>,
  team: Record<string, unknown> | undefined,
) {
  if (!team) return;
  const teamId = String(
    team.TeamID || team.teamId || team.team_id || "",
  ).trim();
  const players = (team.Players || team.players || []) as unknown[];
  for (const row of players) {
    const p = row as Record<string, unknown>;
    const subject = playerSubject(p);
    if (!subject) continue;
    bySubject.set(subject, {
      ...p,
      TeamID: teamId || p.TeamID || p.teamId || p.team_id || "",
    });
  }
}

/** 从 pregame / core-game 对局 JSON 提取玩家列表（合并 Teams + AllyTeam/EnemyTeam） */
export function extractRawPlayersFromMatch(
  match: Record<string, unknown>,
  mySubject: string,
): { rawPlayers: Record<string, unknown>[]; myTeamId: string } {
  const bySubject = new Map<string, Record<string, unknown>>();

  const direct = (match.Players || match.players) as unknown[] | undefined;
  if (Array.isArray(direct)) {
    for (const row of direct) {
      const p = row as Record<string, unknown>;
      const subject = playerSubject(p);
      if (!subject) continue;
      bySubject.set(subject, {
        ...p,
        TeamID: String(p.TeamID || p.teamId || p.team_id || "").trim(),
      });
    }
  }

  const teams = (match.Teams || match.teams) as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(teams)) {
    for (const team of teams) addTeamPlayers(bySubject, team);
  }

  addTeamPlayers(bySubject, match.AllyTeam as Record<string, unknown> | undefined);
  addTeamPlayers(bySubject, match.allyTeam as Record<string, unknown> | undefined);
  addTeamPlayers(bySubject, match.EnemyTeam as Record<string, unknown> | undefined);
  addTeamPlayers(bySubject, match.enemyTeam as Record<string, unknown> | undefined);

  const rawPlayers = [...bySubject.values()];
  if (!rawPlayers.length) return { rawPlayers: [], myTeamId: "" };

  let myTeamId = "";
  const allyTeam = (match.AllyTeam || match.allyTeam) as
    | Record<string, unknown>
    | undefined;
  if (allyTeam) {
    const allyPlayers = (allyTeam.Players || allyTeam.players || []) as unknown[];
    if (
      allyPlayers.some(
        (r) => playerSubject(r as Record<string, unknown>) === mySubject,
      )
    ) {
      myTeamId = String(
        allyTeam.TeamID || allyTeam.teamId || allyTeam.team_id || "",
      ).trim();
    }
  }
  if (!myTeamId) {
    const myRow = rawPlayers.find((r) => playerSubject(r) === mySubject);
    myTeamId = String(
      myRow?.TeamID || myRow?.teamId || myRow?.team_id || "",
    ).trim();
  }

  return { rawPlayers, myTeamId };
}

function selectionStateRank(raw: string): number {
  const n = raw.trim().toLowerCase();
  if (!n) return 0;
  if (n.includes("lock") || n === "confirmed" || n === "ready") return 2;
  if (n.includes("select") || n.includes("pick")) return 1;
  return 0;
}

function playerAgentId(row: Record<string, unknown>): string {
  return String(
    row.CharacterID ||
      row.CharacterId ||
      row.characterId ||
      row.PickedCharacterID ||
      row.pickedCharacterID ||
      "",
  ).trim();
}

function playerSelectionRaw(row: Record<string, unknown>): string {
  return String(
    row.CharacterSelectionState ||
      row.characterSelectionState ||
      row.PregamePlayerState ||
      row.pregamePlayerState ||
      "",
  ).trim();
}

/** 合并同一玩家行：保留 CharacterID 与更高的选锁状态 */
function mergePlayerRow(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const agentA = playerAgentId(a);
  const agentB = playerAgentId(b);
  const stateA = playerSelectionRaw(a);
  const stateB = playerSelectionRaw(b);
  const pickState = selectionStateRank(stateA) >= selectionStateRank(stateB) ? stateA : stateB;
  const pickAgent = agentA || agentB;

  return {
    ...b,
    ...a,
    CharacterID: pickAgent || a.CharacterID || b.CharacterID,
    CharacterSelectionState:
      pickState || a.CharacterSelectionState || b.CharacterSelectionState,
    CompetitiveTier: Math.max(
      Number(a.CompetitiveTier ?? a.competitiveTier ?? 0),
      Number(b.CompetitiveTier ?? b.competitiveTier ?? 0),
    ) || a.CompetitiveTier || b.CompetitiveTier,
    SeasonalBadgeInfo: a.SeasonalBadgeInfo || b.SeasonalBadgeInfo,
  };
}

function mergePlayerArrays(a: unknown, b: unknown): unknown[] {
  const ar = (Array.isArray(a) ? a : []) as Record<string, unknown>[];
  const br = (Array.isArray(b) ? b : []) as Record<string, unknown>[];
  const bySubject = new Map<string, Record<string, unknown>>();

  for (const row of [...br, ...ar]) {
    const subject = playerSubject(row);
    if (!subject) continue;
    const existing = bySubject.get(subject);
    bySubject.set(subject, existing ? mergePlayerRow(existing, row) : row);
  }

  return [...bySubject.values()];
}

function mergeTeamObject(a: unknown, b: unknown): unknown {
  const ta = (a || null) as Record<string, unknown> | null;
  const tb = (b || null) as Record<string, unknown> | null;
  if (!ta) return tb;
  if (!tb) return ta;
  return {
    ...tb,
    ...ta,
    Players: mergePlayerArrays(ta.Players, tb.Players),
  };
}

function mergeTeamArrays(a: unknown, b: unknown): unknown {
  const ar = (Array.isArray(a) ? a : []) as Record<string, unknown>[];
  const br = (Array.isArray(b) ? b : []) as Record<string, unknown>[];
  if (!ar.length) return b;
  if (!br.length) return a;

  const byTeamId = new Map<string, Record<string, unknown>>();
  for (const team of [...br, ...ar]) {
    const teamId = String(
      team.TeamID || team.teamId || team.team_id || "",
    ).trim();
    const key = teamId || `idx-${byTeamId.size}`;
    const existing = byTeamId.get(key);
    byTeamId.set(key, existing ? (mergeTeamObject(existing, team) as Record<string, unknown>) : team);
  }
  return [...byTeamId.values()];
}

/** 合并两份对局 JSON，按玩家 subject 保留更完整的特工/选锁信息 */
export function mergeMatchPlayerData(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const stateA = String(a.State || a.state || "").trim();
  const stateB = String(b.State || b.state || "").trim();
  const preA = String(a.PregameState || a.pregameState || "").trim();
  const preB = String(b.PregameState || b.pregameState || "").trim();

  return {
    ...b,
    ...a,
    Teams: mergeTeamArrays(a.Teams, b.Teams),
    AllyTeam: mergeTeamObject(a.AllyTeam, b.AllyTeam),
    EnemyTeam: mergeTeamObject(a.EnemyTeam, b.EnemyTeam),
    Players: mergePlayerArrays(a.Players, b.Players),
    EnemyTeamSize: Math.max(
      Number(a.EnemyTeamSize ?? a.enemyTeamSize ?? 0),
      Number(b.EnemyTeamSize ?? b.enemyTeamSize ?? 0),
    ) || a.EnemyTeamSize || b.EnemyTeamSize,
    PregameState: preA.length >= preB.length ? preA || preB : preB || preA,
    State: stateA || stateB,
  };
}

function buildAllySubjectSet(
  match: Record<string, unknown>,
  myTeamId: string,
  rawPlayers: Record<string, unknown>[],
): Set<string> {
  const set = new Set<string>();
  const ally = (match.AllyTeam || match.allyTeam) as
    | Record<string, unknown>
    | undefined;
  if (ally) {
    const players = (ally.Players || ally.players || []) as unknown[];
    for (const row of players) {
      const s = playerSubject(row as Record<string, unknown>);
      if (s) set.add(s);
    }
    if (set.size) return set;
  }
  for (const p of rawPlayers) {
    const s = playerSubject(p);
    const tid = String(p.TeamID || p.teamId || p.team_id || "").trim();
    if (s && myTeamId && tid === myTeamId) set.add(s);
  }
  return set;
}

function parseRankTier(
  p: Record<string, unknown>,
  identity: Record<string, unknown>,
  badge: Record<string, unknown>,
): number {
  return Number(
    badge.Rank ??
      badge.rank ??
      badge.CompetitiveTier ??
      badge.competitiveTier ??
      badge.Tier ??
      badge.tier ??
      identity.CompetitiveTier ??
      identity.competitiveTier ??
      p.CompetitiveTier ??
      p.competitiveTier ??
      p.Rank ??
      p.rank ??
      0,
  );
}

function parseSelectionState(raw: string): AgentSelectionState {
  const rank = selectionStateRank(raw);
  if (rank >= 2) return "locked";
  if (rank >= 1) return "selected";
  return "";
}

function shouldInferAgentState(
  phase: LivePhase,
  match: Record<string, unknown>,
): boolean {
  const matchState = String(match.State || match.state || "").toUpperCase();
  if (matchState === "IN_PROGRESS") return false;
  const pregameState = String(
    match.PregameState || match.pregameState || "",
  ).toLowerCase();
  if (pregameState.includes("character_select")) return true;
  if (matchState === "PROVISIONING") return true;
  return phase === "pregame";
}

function refinePhase(
  apiPhase: LivePhase,
  match: Record<string, unknown>,
): LivePhase {
  const state = String(match.State || match.state || "").toUpperCase();
  // 全员锁定后 pregame 结束、core-game PROVISIONING：仍属选人收尾阶段
  if (apiPhase === "ingame" && state === "PROVISIONING") {
    return "pregame";
  }
  return apiPhase;
}

function parsePlayers(
  rawPlayers: unknown[],
  mySubject: string,
  myTeamId: string,
  allySubjects: Set<string>,
  options?: { inferLockedFromAgent?: boolean },
): LivePlayer[] {
  const partyCounts = new Map<string, number>();
  for (const row of rawPlayers) {
    const p = row as Record<string, unknown>;
    const partyId = String(p.PartyID || p.partyId || p.party_id || "").trim();
    if (partyId) partyCounts.set(partyId, (partyCounts.get(partyId) || 0) + 1);
  }

  return rawPlayers.map((row) => {
    const p = row as Record<string, unknown>;
    const subject = playerSubject(p);
    const teamId = String(p.TeamID || p.teamId || p.team_id || "").trim();
    const partyId = String(p.PartyID || p.partyId || p.party_id || "").trim();
    const identity = (p.PlayerIdentity || p.playerIdentity || {}) as Record<
      string,
      unknown
    >;
    const badge = (p.SeasonalBadgeInfo ||
      p.seasonalBadgeInfo ||
      {}) as Record<string, unknown>;

    const accountLevel = Number(
      identity.AccountLevel ?? identity.accountLevel ?? 0,
    );
    const rankTier = parseRankTier(p, identity, badge);
    const agentId = playerAgentId(p);
    const selectionRaw = playerSelectionRaw(p);
    let agentSelectionState = parseSelectionState(selectionRaw);
    if (!agentSelectionState && agentId && options?.inferLockedFromAgent) {
      agentSelectionState = "locked";
    }
    const playerCardId = String(
      identity.PlayerCardID ?? identity.playerCardId ?? "",
    ).trim();

    return {
      subject,
      team_id: teamId,
      party_id: partyId,
      party_size: partyId ? partyCounts.get(partyId) || 1 : 1,
      party_index: 0,
      agent_id: agentId,
      agent_name: agentId ? getAgentName(agentId) : "未选",
      agent_selection_state: agentSelectionState,
      player_card_id: playerCardId,
      account_level: accountLevel,
      rank_tier: rankTier,
      rank_name: getRankName(rankTier),
      is_me: subject === mySubject,
      is_ally: allySubjects.size
        ? allySubjects.has(subject)
        : !!myTeamId && teamId === myTeamId,
    };
  });
}

function buildPartyGroups(
  players: LivePlayer[],
  myTeamId: string,
): LivePartyGroup[] {
  const map = new Map<
    string,
    { subjects: string[]; team_id: string; size: number }
  >();
  for (const p of players) {
    if (!p.party_id || p.party_size < 2) continue;
    const existing = map.get(p.party_id);
    if (existing) {
      existing.subjects.push(p.subject);
    } else {
      map.set(p.party_id, {
        subjects: [p.subject],
        team_id: p.team_id,
        size: p.party_size,
      });
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([party_id, info], idx) => ({
      party_id,
      party_index: idx + 1,
      size: info.size,
      subjects: info.subjects,
      team_id: info.team_id,
      is_ally: !!myTeamId && info.team_id === myTeamId,
    }));
}

function assignPartyIndexes(
  players: LivePlayer[],
  parties: LivePartyGroup[],
): LivePlayer[] {
  const indexByPartyId = new Map(
    parties.map((g) => [g.party_id, g.party_index]),
  );
  return players.map((p) => ({
    ...p,
    party_index: p.party_id ? indexByPartyId.get(p.party_id) || 0 : 0,
  }));
}

function emptySnapshot(mySubject: string): LiveMatchSnapshot {
  return {
    active: false,
    phase: "none",
    match_id: "",
    map_id: "",
    map_name: "",
    mode: "",
    state: "",
    my_subject: mySubject,
    my_team_id: "",
    parties: [],
    players: [],
    enemy_pending_count: 0,
    pregame_state: "",
  };
}

function buildSnapshotFromMatch(
  match: Record<string, unknown>,
  phase: LivePhase,
  matchId: string,
  mySubject: string,
): LiveMatchSnapshot | null {
  if (!isLiveMatchBodyActive(match)) return null;

  const { rawPlayers, myTeamId } = extractRawPlayersFromMatch(match, mySubject);
  if (!rawPlayers.length) return null;

  const displayPhase = refinePhase(phase, match);
  const allySubjects = buildAllySubjectSet(match, myTeamId, rawPlayers);
  const playersRaw = parsePlayers(rawPlayers, mySubject, myTeamId, allySubjects, {
    inferLockedFromAgent: shouldInferAgentState(displayPhase, match),
  });
  const parties = buildPartyGroups(playersRaw, myTeamId);
  const players = assignPartyIndexes(playersRaw, parties);

  const enemyTeam = match.EnemyTeam || match.enemyTeam;
  const enemyTeamSize = Number(match.EnemyTeamSize ?? match.enemyTeamSize ?? 0);
  const allyCount = players.filter((p) => p.is_ally).length;
  const enemyCount = players.filter((p) => !p.is_ally).length;
  let enemyPending = 0;
  if (enemyCount === 0 && enemyTeamSize > 0) {
    enemyPending = enemyTeamSize;
  } else if (enemyTeamSize > enemyCount) {
    enemyPending = enemyTeamSize - enemyCount;
  }
  // 已有 EnemyTeam 玩家数据时不显示占位
  const enemyTeamPlayers = enemyTeam
    ? ((enemyTeam as Record<string, unknown>).Players ||
        (enemyTeam as Record<string, unknown>).players ||
        []) as unknown[]
    : [];
  if (enemyTeamPlayers.length > 0 && enemyCount >= enemyTeamPlayers.length) {
    enemyPending = Math.max(0, enemyTeamSize - enemyCount);
  }

  return {
    active: true,
    phase: displayPhase,
    match_id: matchId,
    map_id: String(match.MapID || match.mapId || match.MapId || ""),
    map_name: getMapName(
      String(match.MapID || match.mapId || match.MapId || ""),
    ),
    mode: String(match.Mode || match.mode || match.ModeID || ""),
    state: String(match.State || match.state || ""),
    pregame_state: String(match.PregameState || match.pregameState || ""),
    my_subject: mySubject,
    my_team_id: myTeamId,
    parties,
    players,
    enemy_pending_count: enemyPending,
  };
}

async function getLocalPuuid(lock: LockfileInfo): Promise<string | null> {
  const res = await localRiotFetch(lock, "/chat/v1/session");
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  return String(data.puuid || data.Puuid || "").trim() || null;
}

async function resolveActiveMatchViaFetch(
  fetchPlayer: (puuid: string, api: "core-game" | "pregame") => Promise<Response>,
  puuid: string,
): Promise<{ phase: LivePhase; matchId: string; api: "core-game" | "pregame" } | null> {
  const preRes = await fetchPlayer(puuid, "pregame");
  if (preRes.ok) {
    const data = (await preRes.json()) as Record<string, unknown>;
    const matchId = String(data.MatchID || data.matchId || "").trim();
    if (matchId) return { phase: "pregame", matchId, api: "pregame" };
  }

  const coreRes = await fetchPlayer(puuid, "core-game");
  if (coreRes.ok) {
    const data = (await coreRes.json()) as Record<string, unknown>;
    const matchId = String(data.MatchID || data.matchId || "").trim();
    if (matchId) return { phase: "ingame", matchId, api: "core-game" };
  }

  return null;
}

async function fetchMatchViaFetch(
  fetchMatch: (api: "core-game" | "pregame", matchId: string) => Promise<Response>,
  active: { phase: LivePhase; matchId: string; api: "core-game" | "pregame" },
): Promise<Record<string, unknown> | null> {
  const primary = await fetchMatch(active.api, active.matchId);
  if (!primary.ok) return null;

  let match = (await primary.json()) as Record<string, unknown>;
  const altApi = active.api === "pregame" ? "core-game" : "pregame";

  try {
    const alt = await fetchMatch(altApi, active.matchId);
    if (alt.ok) {
      match = mergeMatchPlayerData(
        match,
        (await alt.json()) as Record<string, unknown>,
      );
    }
  } catch {
    // ignore secondary fetch
  }

  return match;
}

function mergeWithCompanionSources(
  match: Record<string, unknown>,
  matchId: string,
): Record<string, unknown> {
  let merged = match;

  const cacheRaw = readLiveMatchCacheRaw();
  if (cacheRaw?.match_id === matchId && cacheRaw.body) {
    merged = mergeMatchPlayerData(merged, cacheRaw.body);
  }

  const richest = readRichestCompanionSnapshot(matchId);
  if (richest) {
    merged = mergeMatchPlayerData(merged, richest);
  }

  return merged;
}

function snapshotFromCache(
  entry: LiveMatchCacheEntry,
  mySubject: string,
): LiveMatchSnapshot | null {
  if (!isLiveMatchBodyActive(entry.body)) return null;
  const phase: LivePhase =
    entry.phase === "ingame" ? "ingame" : "pregame";
  return buildSnapshotFromMatch(
    entry.body,
    phase,
    entry.match_id,
    mySubject,
  );
}

function snapshotFromCacheIfAuthoritative(
  entry: LiveMatchCacheEntry | null,
  mySubject: string,
): LiveMatchSnapshot | null {
  if (!entry || !isLiveMatchCacheFresh(entry)) return null;
  return snapshotFromCache(entry, mySubject);
}

async function fetchViaLockfile(lock: LockfileInfo): Promise<{
  snapshot: LiveMatchSnapshot | null;
  error?: string;
  source: LiveDataSource;
}> {
  const mySubject = await getLocalPuuid(lock);
  if (!mySubject) {
    return { snapshot: null, error: "local_session_unavailable", source: "lockfile" };
  }

  const active = await resolveActiveMatchViaFetch(
    (puuid, api) =>
      localRiotFetch(lock, `/${api}/v1/players/${encodeURIComponent(puuid)}`),
    mySubject,
  );

  if (!active) {
    return { snapshot: inactiveSnapshot(mySubject), source: "lockfile" };
  }

  const match = await fetchMatchViaFetch(
    (api, matchId) =>
      localRiotFetch(
        lock,
        `/${api}/v1/matches/${encodeURIComponent(matchId)}`,
      ),
    active,
  );

  if (!match) {
    return {
      snapshot: null,
      error: "match_fetch_failed",
      source: "lockfile",
    };
  }

  const merged = mergeWithCompanionSources(match, active.matchId);

  if (!isLiveMatchBodyActive(merged)) {
    return { snapshot: inactiveSnapshot(mySubject), source: "lockfile" };
  }

  const snapshot = buildSnapshotFromMatch(
    merged,
    active.phase,
    active.matchId,
    mySubject,
  );
  if (!snapshot) {
    return { snapshot: null, error: "match_has_no_players", source: "lockfile" };
  }

  return { snapshot, source: "lockfile" };
}

async function fetchViaGlzOrCache(): Promise<{
  snapshot: LiveMatchSnapshot | null;
  error?: string;
  source?: LiveDataSource;
}> {
  const session = await getRiotSession();
  const mySubject = session ? subjectFromSession(session) : null;

  if (!session || !mySubject) {
    const cached = readLiveMatchCache();
    if (cached && isLiveMatchCacheFresh(cached)) {
      const snapshot = snapshotFromCache(cached, mySubject || "");
      if (snapshot?.active) {
        return { snapshot, source: "companion_cache" };
      }
    }
    return {
      snapshot: null,
      error: session ? "session_subject_missing" : "session_unavailable",
    };
  }

  try {
    const active = await resolveActiveMatchViaFetch(
      (puuid, api) =>
        glzFetch(`/${api}/v1/players/${encodeURIComponent(puuid)}`),
      mySubject,
    );

    if (!active) {
      return { snapshot: inactiveSnapshot(mySubject), source: "glz" };
    }

    let match = await fetchMatchViaFetch(
      (api, matchId) =>
        glzFetch(`/${api}/v1/matches/${encodeURIComponent(matchId)}`),
      active,
    );

    if (!match) {
      const cached = snapshotFromCacheIfAuthoritative(
        readLiveMatchCache(),
        mySubject,
      );
      if (cached?.active) {
        return { snapshot: cached, source: "companion_cache" };
      }
      return {
        snapshot: null,
        error: `match_fetch_failed`,
        source: "glz",
      };
    }

    let phase = active.phase;
    match = mergeWithCompanionSources(match, active.matchId);

    if (!isLiveMatchBodyActive(match)) {
      return { snapshot: inactiveSnapshot(mySubject), source: "glz" };
    }

    const ps = String(match.PregameState || "").toLowerCase();
    if (
      active.api === "core-game" &&
      ps.includes("character_select") &&
      String(match.State || "").toUpperCase() !== "IN_PROGRESS"
    ) {
      phase = "pregame";
    }

    const snapshot = buildSnapshotFromMatch(
      match,
      phase,
      active.matchId,
      mySubject,
    );
    if (!snapshot) {
      return { snapshot: null, error: "match_has_no_players", source: "glz" };
    }

    return { snapshot, source: "glz" };
  } catch (err) {
    const cached = snapshotFromCacheIfAuthoritative(
      readLiveMatchCache(),
      mySubject,
    );
    if (cached?.active) {
      return { snapshot: cached, source: "companion_cache" };
    }
    return {
      snapshot: null,
      error: err instanceof Error ? err.message : "glz_fetch_failed",
      source: "glz",
    };
  }
}

/** 读取当前对局（无远程 enrichment） */
export async function fetchLiveMatchSnapshot(): Promise<{
  snapshot: LiveMatchSnapshot | null;
  error?: string;
  source?: LiveDataSource;
}> {
  const lock = await readLockfile();
  if (lock) {
    return fetchViaLockfile(lock);
  }
  return fetchViaGlzOrCache();
}
