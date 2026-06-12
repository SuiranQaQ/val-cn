import type { ProcessedMatch, ProcessedPlayer } from "./match-processor";
import { extractPlayerBehavior } from "./match-behavior";

export interface TeammateStat {
  name: string;
  subject: string;
  card_icon?: string;
  games: number;
  wins: number;
  winRate: number;
}

export interface PartyRecord {
  name: string;
  subject: string;
  card_icon?: string;
  games: number;
  lastPlayed: string;
  lastPlayedMs: number;
}

export interface AgentStat {
  agent_id: string;
  agent_name: string;
  agent_icon?: string;
  games: number;
  wins: number;
  winRate: number;
  avgAcs: number;
}

export interface RecentSummary {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKda: string;
  avgAcs: number;
  mvpCount: number;
}

export interface RankTrendPoint {
  label: string;
  tier: number;
  rr: number;
  changed: number;
}

export const QUEUE_FILTER_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "competitive", label: "竞技" },
  { id: "unrated", label: "普通" },
  { id: "swiftplay", label: "极速" },
  { id: "deathmatch", label: "死斗" },
  { id: "spikerush", label: "尖锋" },
] as const;

export type QueueFilterId = (typeof QUEUE_FILTER_OPTIONS)[number]["id"];

const MS_DAY = 24 * 60 * 60 * 1000;

function playerDisplayName(player: {
  gameName: string;
  tagLine: string;
  subject: string;
}): string {
  const gn = player.gameName.trim();
  const tag = player.tagLine.trim();
  if (gn && gn !== "未知") return tag ? `${gn}#${tag}` : gn;
  if (tag) return `#${tag}`;
  return player.subject ? `${player.subject.slice(0, 8)}…` : "未知";
}

function preferName(current: string, next: string): string {
  if (!next || next === "未知" || next.startsWith("未知#")) return current;
  if (
    !current ||
    current === "未知" ||
    current.startsWith("未知#") ||
    current.endsWith("…")
  ) {
    return next;
  }
  return current;
}

function withinDays(match: ProcessedMatch, days: number, now = Date.now()): boolean {
  if (!match.game_start_ms) return true;
  return now - match.game_start_ms <= days * MS_DAY;
}

export function filterMatchesByQueue(
  matches: ProcessedMatch[],
  queueFilter: QueueFilterId,
): ProcessedMatch[] {
  if (queueFilter === "all") return matches;
  return matches.filter((m) => m.queue_id === queueFilter);
}

export function computeTeammateStats(
  matches: ProcessedMatch[],
  _subject: string,
): TeammateStat[] {
  const map = new Map<string, TeammateStat>();

  for (const match of matches) {
    const myPartyIds = new Set(
      match.teammates
        .filter((p) => p.is_me || p.is_teammate)
        .map((p) => p.party_id)
        .filter(Boolean),
    );

    for (const player of match.teammates) {
      if (player.is_me) continue;
      const key = player.subject || `${player.gameName}#${player.tagLine}`;
      const displayName = playerDisplayName(player);
      const existing = map.get(key) || {
        name: displayName,
        subject: player.subject,
        card_icon: player.player_card_icon,
        games: 0,
        wins: 0,
        winRate: 0,
      };
      existing.name = preferName(existing.name, displayName);
      if (player.player_card_icon) {
        existing.card_icon = player.player_card_icon;
      }
      existing.games += 1;
      if (match.is_win) existing.wins += 1;
      existing.winRate =
        existing.games > 0
          ? Math.round((existing.wins / existing.games) * 100)
          : 0;
      map.set(key, existing);
    }

    if (myPartyIds.size) {
      for (const player of [...match.teammates, ...match.enemies]) {
        if (player.is_me || !myPartyIds.has(player.party_id)) continue;
        const key = player.subject || `${player.gameName}#${player.tagLine}`;
        if (map.has(key)) continue;
        map.set(key, {
          name: playerDisplayName(player),
          subject: player.subject,
          card_icon: player.player_card_icon,
          games: 1,
          wins: match.is_win ? 1 : 0,
          winRate: match.is_win ? 100 : 0,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.games - a.games)
    .slice(0, 8);
}

/** 常开黑队友（1个月） */
export function computeFrequentPartyMates(
  matches: ProcessedMatch[],
  subject: string,
  days = 30,
): PartyRecord[] {
  const map = new Map<string, PartyRecord>();
  const now = Date.now();

  for (const match of matches) {
    if (!withinDays(match, days, now)) continue;
    const me = match.teammates.find((p) => p.is_me);
    if (!me?.party_id) continue;

    const partySize = [...match.teammates, ...match.enemies].filter(
      (p) => p.party_id === me.party_id,
    ).length;
    if (partySize < 2) continue;

    const partyMembers = [...match.teammates, ...match.enemies].filter(
      (p) => p.party_id === me.party_id && !p.is_me,
    );

    for (const player of partyMembers) {
      const key = player.subject || `${player.gameName}#${player.tagLine}`;
      const displayName = playerDisplayName(player);
      const existing = map.get(key) || {
        name: displayName,
        subject: player.subject,
        card_icon: player.player_card_icon,
        games: 0,
        lastPlayed: match.game_start,
        lastPlayedMs: match.game_start_ms,
      };
      existing.name = preferName(existing.name, displayName);
      if (player.player_card_icon) {
        existing.card_icon = player.player_card_icon;
      }
      existing.games += 1;
      if (match.game_start_ms >= existing.lastPlayedMs) {
        existing.lastPlayed = match.game_start;
        existing.lastPlayedMs = match.game_start_ms;
      }
      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.games - a.games)
    .slice(0, 8);
}

/** 最近开黑（1周） */
export function computeRecentPartySessions(
  matches: ProcessedMatch[],
  _subject: string,
  days = 7,
): PartyRecord[] {
  const now = Date.now();
  const sessions: PartyRecord[] = [];

  for (const match of matches) {
    if (!withinDays(match, days, now)) continue;
    const me = match.teammates.find((p) => p.is_me);
    if (!me?.party_id) continue;

    const partyMembers = [...match.teammates, ...match.enemies].filter(
      (p) => p.party_id === me.party_id && !p.is_me,
    );
    if (!partyMembers.length) continue;

    const names = partyMembers.map((p) => playerDisplayName(p)).join("、");
    sessions.push({
      name: names,
      subject: match.match_id,
      games: partyMembers.length,
      lastPlayed: match.game_start,
      lastPlayedMs: match.game_start_ms,
    });
  }

  return sessions
    .sort((a, b) => b.lastPlayedMs - a.lastPlayedMs)
    .slice(0, 8);
}

export function computeAgentStats(
  matches: ProcessedMatch[],
  subject: string,
): AgentStat[] {
  const map = new Map<string, AgentStat>();

  for (const match of matches) {
    const me = match.teammates.find((p) => p.is_me);
    if (!me?.agent_id) continue;

    const key = me.agent_id;
    const existing = map.get(key) || {
      agent_id: me.agent_id,
      agent_name: me.agent_name,
      agent_icon: me.agent_icon,
      games: 0,
      wins: 0,
      winRate: 0,
      avgAcs: 0,
    };
    existing.agent_name = me.agent_name || existing.agent_name;
    existing.agent_icon = me.agent_icon || existing.agent_icon;
    existing.games += 1;
    if (match.is_win) existing.wins += 1;
    existing.avgAcs =
      (existing.avgAcs * (existing.games - 1) + me.acs) / existing.games;
    existing.winRate =
      existing.games > 0
        ? Math.round((existing.wins / existing.games) * 100)
        : 0;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.games - a.games)
    .slice(0, 6);
}

export function computeRecentSummary(matches: ProcessedMatch[]): RecentSummary {
  if (!matches.length) {
    return {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgKda: "-",
      avgAcs: 0,
      mvpCount: 0,
    };
  }

  const wins = matches.filter((m) => m.is_win).length;
  const losses = matches.length - wins;

  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let acsTotal = 0;
  let mvpCount = 0;

  for (const match of matches) {
    const me = match.teammates.find((p) => p.is_me);
    if (!me) continue;
    kills += me.stats.kills;
    deaths += me.stats.deaths;
    assists += me.stats.assists;
    acsTotal += me.acs;
    if (match.is_mvp) mvpCount += 1;
  }

  const n = matches.length;
  const avgK = (kills / n).toFixed(1);
  const avgD = (deaths / n).toFixed(1);
  const avgA = (assists / n).toFixed(1);

  return {
    total: n,
    wins,
    losses,
    winRate: Math.round((wins / n) * 100),
    avgKda: `${avgK}/${avgD}/${avgA}`,
    avgAcs: Math.round(acsTotal / n),
    mvpCount,
  };
}

export function buildRankTrend(
  updates: Record<string, unknown> | null,
): RankTrendPoint[] {
  const matchList = (updates?.Matches || []) as Array<Record<string, unknown>>;
  return matchList
    .slice(0, 10)
    .reverse()
    .map((m, i) => ({
      label: `#${i + 1}`,
      tier: Number(m.TierAfterUpdate || m.tier || 0),
      rr: Number(m.RankedRatingAfterUpdate || m.rr || 0),
      changed: Number(m.RankedRatingEarned || m.rr_change || 0),
    }));
}

export interface MapStat {
  map_id: string;
  map_name: string;
  map_icon?: string;
  map_splash?: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgAcs: number;
}

export interface BehaviorSummary {
  afk_penalty_matches: number;
  my_penalized_rounds: number;
  my_afk_rounds: number;
  spawn_camp_rounds: number;
  flagged_teammate_matches: number;
}

export interface SuspiciousTeammate {
  name: string;
  subject: string;
  card_icon?: string;
  games: number;
  risk_score: number;
  flags: string[];
  last_seen: string;
  co_penalty_games: number;
}

function playerDisplayNameFromProcessed(p: ProcessedPlayer): string {
  const gn = p.gameName.trim();
  const tag = p.tagLine.trim();
  if (gn && gn !== "未知") return tag ? `${gn}#${tag}` : gn;
  if (tag) return `#${tag}`;
  return p.subject.slice(0, 8) + "…";
}

function rawPlayerBehavior(
  match: ProcessedMatch,
  pSubject: string,
): ReturnType<typeof extractPlayerBehavior> | null {
  const raw = match.raw as Record<string, unknown> | undefined;
  const players = (raw?.players || []) as Array<Record<string, unknown>>;
  const rounds = (raw?.roundResults || raw?.round_results || []) as Array<
    Record<string, unknown>
  >;
  const player = players.find(
    (p) => String(p.subject || p.Subject) === pSubject,
  );
  if (!player) return null;
  return extractPlayerBehavior(player, rounds);
}

export function computeMapStats(matches: ProcessedMatch[]): MapStat[] {
  const map = new Map<string, MapStat>();

  for (const match of matches) {
    const me = match.teammates.find((p) => p.is_me);
    if (!me) continue;
    const key = match.map_id || match.map_name;
    const existing = map.get(key) || {
      map_id: match.map_id,
      map_name: match.map_name,
      map_icon: match.map_icon,
      map_splash: match.map_splash,
      games: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgAcs: 0,
    };
    existing.map_icon = match.map_icon || existing.map_icon;
    existing.map_splash = match.map_splash || existing.map_splash;
    existing.games += 1;
    if (match.is_win) existing.wins += 1;
    else existing.losses += 1;
    existing.avgAcs =
      (existing.avgAcs * (existing.games - 1) + me.acs) / existing.games;
    existing.winRate =
      existing.games > 0
        ? Math.round((existing.wins / existing.games) * 100)
        : 0;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.games - a.games)
    .slice(0, 8);
}

export function computeBehaviorSummary(
  matches: ProcessedMatch[],
  updates: Record<string, unknown> | null,
): BehaviorSummary {
  const penaltyMatchIds = new Set<string>();
  const updateList = (updates?.Matches || []) as Array<Record<string, unknown>>;
  for (const u of updateList) {
    if (Number(u.AFKPenalty || 0) > 0) {
      penaltyMatchIds.add(String(u.MatchID || ""));
    }
  }

  let myPenalized = 0;
  let myAfk = 0;
  let spawnCamp = 0;
  let flaggedMatches = 0;

  for (const match of matches) {
    const me = match.teammates.find((p) => p.is_me);
    if (me?.behavior) {
      myPenalized += me.behavior.penalized_rounds;
      myAfk += me.behavior.afk_rounds;
      spawnCamp += me.behavior.spawn_camp_rounds;
    }

    const hasFlaggedTeammate = match.teammates.some(
      (p) => !p.is_me && (p.behavior?.flags.length || 0) > 0,
    );
    if (hasFlaggedTeammate) flaggedMatches += 1;
  }

  let afkPenaltyInLoaded = 0;
  for (const m of matches) {
    if (penaltyMatchIds.has(m.match_id)) afkPenaltyInLoaded += 1;
  }

  return {
    afk_penalty_matches: afkPenaltyInLoaded,
    my_penalized_rounds: myPenalized,
    my_afk_rounds: myAfk,
    spawn_camp_rounds: spawnCamp,
    flagged_teammate_matches: flaggedMatches,
  };
}

/**
 * 可疑队友分析（非官方封禁查询）
 * Riot 不允许查他人封禁状态，只能从比赛内行为推断
 */
export function computeSuspiciousTeammates(
  matches: ProcessedMatch[],
  _subject: string,
  updates: Record<string, unknown> | null,
): SuspiciousTeammate[] {
  const penaltyMatchIds = new Set<string>();
  const updateList = (updates?.Matches || []) as Array<Record<string, unknown>>;
  for (const u of updateList) {
    if (Number(u.AFKPenalty || 0) > 0) {
      penaltyMatchIds.add(String(u.MatchID || ""));
    }
  }

  const map = new Map<
    string,
    SuspiciousTeammate & { flagSet: Set<string> }
  >();

  for (const match of matches) {
    const me = match.teammates.find((p) => p.is_me);
    const myPartyId = me?.party_id || "";
    const iGotPenalty = penaltyMatchIds.has(match.match_id);

    const candidates = [
      ...match.teammates.filter((p) => !p.is_me),
      ...match.enemies.filter(
        (p) => myPartyId && p.party_id === myPartyId,
      ),
    ];

    for (const player of candidates) {
      const behavior =
        player.behavior || rawPlayerBehavior(match, player.subject);
      if (!behavior) continue;

      const risk =
        behavior.penalized_rounds * 4 +
        behavior.afk_rounds * 2 +
        behavior.afk_behavior_rounds * 2 +
        behavior.spawn_camp_rounds * 2 +
        (behavior.friendly_fire_out > 0.15 ? 3 : 0);

      const onMyTeam = match.teammates.some(
        (t) => t.subject === player.subject && !t.is_me,
      );
      const coPenalty =
        iGotPenalty && (onMyTeam || (myPartyId && player.party_id === myPartyId))
          ? 1
          : 0;

      const totalRisk = risk + coPenalty * 6;
      if (totalRisk <= 0 && behavior.flags.length === 0) continue;

      const key = player.subject || playerDisplayNameFromProcessed(player);
      const displayName = playerDisplayNameFromProcessed(player);
      const existing = map.get(key) || {
        name: displayName,
        subject: player.subject,
        card_icon: player.player_card_icon,
        games: 0,
        risk_score: 0,
        flags: [] as string[],
        last_seen: match.game_start,
        co_penalty_games: 0,
        flagSet: new Set<string>(),
      };

      existing.name = preferName(existing.name, displayName);
      if (player.player_card_icon) {
        existing.card_icon = player.player_card_icon;
      }
      existing.games += 1;
      existing.risk_score += totalRisk;
      existing.co_penalty_games += coPenalty;
      existing.last_seen = match.game_start;
      for (const f of behavior.flags) existing.flagSet.add(f);
      if (coPenalty) existing.flagSet.add("与你同场时你吃到竞技罚分");
      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .map(({ flagSet, ...rest }) => ({
      ...rest,
      flags: [...flagSet].slice(0, 5),
    }))
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8);
}

/** @deprecated use computeFrequentPartyMates */
export function computePartyRecords(
  matches: ProcessedMatch[],
  subject: string,
): PartyRecord[] {
  return computeFrequentPartyMates(matches, subject, 30);
}
