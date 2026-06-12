/**
 * 本机对局认人：pregame（选人）/ core-game（局内）
 * 需瓦罗兰特客户端运行 + lockfile
 */

import { getAgentName, getMapName, getRankName } from "./constants";
import { localRiotFetch, readLockfile, type LockfileInfo } from "./riot-lockfile";

export type LivePhase = "pregame" | "ingame" | "none";

export interface LivePartyGroup {
  party_id: string;
  /** 本局内组队编号，用于 UI 配色（1、2、3…） */
  party_index: number;
  size: number;
  subjects: string[];
  team_id: string;
  is_ally: boolean;
}

export interface LivePlayer {
  subject: string;
  team_id: string;
  party_id: string;
  party_size: number;
  /** 与 parties[].party_index 对应；0 = 单排 */
  party_index: number;
  agent_id: string;
  agent_name: string;
  account_level: number;
  rank_tier: number;
  rank_name: string;
  is_me: boolean;
  is_ally: boolean;
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
}

async function getLocalPuuid(lock: LockfileInfo): Promise<string | null> {
  const res = await localRiotFetch(lock, "/chat/v1/session");
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const puuid = String(data.puuid || data.Puuid || "").trim();
  return puuid || null;
}

async function resolveActiveMatch(
  lock: LockfileInfo,
  puuid: string,
): Promise<{ phase: LivePhase; matchId: string; api: "core-game" | "pregame" } | null> {
  const coreRes = await localRiotFetch(
    lock,
    `/core-game/v1/players/${encodeURIComponent(puuid)}`,
  );
  if (coreRes.ok) {
    const data = (await coreRes.json()) as Record<string, unknown>;
    const matchId = String(data.MatchID || data.matchId || "").trim();
    if (matchId) return { phase: "ingame", matchId, api: "core-game" };
  }

  const preRes = await localRiotFetch(
    lock,
    `/pregame/v1/players/${encodeURIComponent(puuid)}`,
  );
  if (preRes.ok) {
    const data = (await preRes.json()) as Record<string, unknown>;
    const matchId = String(data.MatchID || data.matchId || "").trim();
    if (matchId) return { phase: "pregame", matchId, api: "pregame" };
  }

  return null;
}

function parsePlayers(
  rawPlayers: unknown[],
  mySubject: string,
  myTeamId: string,
): LivePlayer[] {
  const partyCounts = new Map<string, number>();
  for (const row of rawPlayers) {
    const p = row as Record<string, unknown>;
    const partyId = String(p.PartyID || p.partyId || p.party_id || "").trim();
    if (partyId) partyCounts.set(partyId, (partyCounts.get(partyId) || 0) + 1);
  }

  return rawPlayers.map((row) => {
    const p = row as Record<string, unknown>;
    const subject = String(p.Subject || p.subject || "").trim();
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
    const rankTier = Number(
      badge.Rank ?? badge.rank ?? p.CompetitiveTier ?? p.competitiveTier ?? 0,
    );
    const agentId = String(
      p.CharacterID || p.CharacterId || p.characterId || "",
    ).trim();

    return {
      subject,
      team_id: teamId,
      party_id: partyId,
      party_size: partyId ? partyCounts.get(partyId) || 1 : 1,
      party_index: 0,
      agent_id: agentId,
      agent_name: agentId ? getAgentName(agentId) : "未选",
      account_level: accountLevel,
      rank_tier: rankTier,
      rank_name: getRankName(rankTier),
      is_me: subject === mySubject,
      is_ally: !!myTeamId && teamId === myTeamId,
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

/** 读取当前对局（无远程 enrichment） */
export async function fetchLiveMatchSnapshot(): Promise<{
  snapshot: LiveMatchSnapshot | null;
  error?: string;
}> {
  const lock = await readLockfile();
  if (!lock) {
    return { snapshot: null, error: "lockfile_not_found" };
  }

  const mySubject = await getLocalPuuid(lock);
  if (!mySubject) {
    return { snapshot: null, error: "local_session_unavailable" };
  }

  const active = await resolveActiveMatch(lock, mySubject);
  if (!active) {
    return {
      snapshot: {
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
      },
    };
  }

  const matchRes = await localRiotFetch(
    lock,
    `/${active.api}/v1/matches/${encodeURIComponent(active.matchId)}`,
  );
  if (!matchRes.ok) {
    return { snapshot: null, error: `match_fetch_failed:${matchRes.status}` };
  }

  const match = (await matchRes.json()) as Record<string, unknown>;
  const rawPlayers = (match.Players || match.players || []) as unknown[];
  if (!rawPlayers.length) {
    return { snapshot: null, error: "match_has_no_players" };
  }

  const myRow = rawPlayers.find(
    (r) =>
      String((r as Record<string, unknown>).Subject || (r as Record<string, unknown>).subject) ===
      mySubject,
  ) as Record<string, unknown> | undefined;
  const myTeamId = String(
    myRow?.TeamID || myRow?.teamId || myRow?.team_id || "",
  ).trim();

  const playersRaw = parsePlayers(rawPlayers, mySubject, myTeamId);
  const parties = buildPartyGroups(playersRaw, myTeamId);
  const players = assignPartyIndexes(playersRaw, parties);

  return {
    snapshot: {
      active: true,
      phase: active.phase,
      match_id: active.matchId,
      map_id: String(match.MapID || match.mapId || match.MapId || ""),
      map_name: getMapName(
        String(match.MapID || match.mapId || match.MapId || ""),
      ),
      mode: String(match.Mode || match.mode || match.ModeID || ""),
      state: String(match.State || match.state || ""),
      my_subject: mySubject,
      my_team_id: myTeamId,
      parties,
      players,
    },
  };
}
