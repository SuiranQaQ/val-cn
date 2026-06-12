/**
 * 对局玩家远程 enrichment：名字、近期战绩、炸鱼分、可疑行为
 * 带内存缓存与请求节流，降低限流风险
 */

import { extractPlayerBehavior } from "./match-behavior";
import { computeSmurfScore } from "./smurf-score";
import type { LivePlayer } from "./live-match";
import {
  fetchCompetitiveUpdates,
  fetchMatchDetail,
  resolvePlayerNames,
} from "./riot";

export interface PlayerEnrichProfile {
  name: string;
  recent_games: number;
  wins: number;
  win_rate: number;
  avg_acs: number;
  avg_kda: number;
  afk_penalty_matches: number;
  smurf_score: number;
  smurf_flags: string[];
  suspicious_score: number;
  suspicious_flags: string[];
  loaded: boolean;
  cached: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const enrichCache = new Map<string, { at: number; profile: PlayerEnrichProfile }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function calcAcs(score: number, rounds: number): number {
  if (!rounds) return 0;
  return Math.round(score / rounds);
}

function kda(k: number, d: number, a: number): number {
  if (!d) return k + a;
  return (k + a) / d;
}

function suspiciousFromBehavior(
  behavior: ReturnType<typeof extractPlayerBehavior>,
  afkPenalties: number,
): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (behavior.afk_rounds > 0) {
    score += behavior.afk_rounds * 3;
    flags.push(`AFK回合×${behavior.afk_rounds}`);
  }
  if (behavior.afk_behavior_rounds >= 2) {
    score += behavior.afk_behavior_rounds * 2;
    flags.push(`行为AFK×${behavior.afk_behavior_rounds}`);
  }
  if (behavior.penalized_rounds > 0) {
    score += behavior.penalized_rounds * 4;
    flags.push(`处罚回合×${behavior.penalized_rounds}`);
  }
  if (behavior.spawn_camp_rounds >= 2) {
    score += behavior.spawn_camp_rounds * 2;
    flags.push(`出生点挂机×${behavior.spawn_camp_rounds}`);
  }
  if (behavior.friendly_fire_out > 0.15) {
    score += 8;
    flags.push("高友伤");
  }
  if (afkPenalties > 0) {
    score += afkPenalties * 10;
    flags.push(`竞技AFK处罚×${afkPenalties}`);
  }

  return { score: Math.min(100, score), flags };
}

async function enrichOnePlayer(
  player: LivePlayer,
  nameMap: Map<string, string>,
): Promise<PlayerEnrichProfile> {
  const cached = enrichCache.get(player.subject);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.profile, cached: true };
  }

  const baseName =
    nameMap.get(player.subject) ||
    `${player.subject.slice(0, 8)}…`;

  const empty: PlayerEnrichProfile = {
    name: baseName,
    recent_games: 0,
    wins: 0,
    win_rate: 0,
    avg_acs: 0,
    avg_kda: 0,
    afk_penalty_matches: 0,
    smurf_score: 0,
    smurf_flags: [],
    suspicious_score: 0,
    suspicious_flags: [],
    loaded: false,
    cached: false,
  };

  try {
    const updates = (await fetchCompetitiveUpdates(player.subject, 10)) as Record<
      string,
      unknown
    >;
    const matches = (updates?.Matches || []) as Array<Record<string, unknown>>;

    let wins = 0;
    let afkPenalties = 0;
    const recentIds: string[] = [];

    for (const m of matches.slice(0, 10)) {
      const won = Boolean(m.Won ?? m.won);
      if (won) wins += 1;
      if (Number(m.AFKPenalty || 0) > 0) afkPenalties += 1;
      const id = String(m.MatchID || m.matchId || "").trim();
      if (id) recentIds.push(id);
    }

    const recentGames = matches.length;
    const winRate =
      recentGames > 0 ? Math.round((wins / recentGames) * 100) : 0;

    let acsSum = 0;
    let acsCount = 0;
    let kdaSum = 0;
    let kdaCount = 0;
    let behaviorAgg = {
      penalized_rounds: 0,
      afk_rounds: 0,
      afk_behavior_rounds: 0,
      spawn_camp_rounds: 0,
      friendly_fire_out: 0,
      flags: [] as string[],
    };

    const detailIds = recentIds.slice(0, 3);
    for (const matchId of detailIds) {
      try {
        const raw = (await fetchMatchDetail(matchId)) as Record<string, unknown>;
        const players = (raw.players || []) as Array<Record<string, unknown>>;
        const rounds = (raw.roundResults || raw.round_results || []) as Array<
          Record<string, unknown>
        >;
        const me = players.find(
          (p) =>
            String(p.subject || p.Subject || "").toLowerCase() ===
            player.subject.toLowerCase(),
        );
        if (!me) continue;

        const stats = (me.stats || {}) as Record<string, number>;
        const score = Number(stats.score || 0);
        const roundsPlayed = rounds.length || 1;
        acsSum += calcAcs(score, roundsPlayed);
        acsCount += 1;

        const k = Number(stats.kills || 0);
        const d = Number(stats.deaths || 0);
        const a = Number(stats.assists || 0);
        kdaSum += kda(k, d, a);
        kdaCount += 1;

        const behavior = extractPlayerBehavior(me, rounds);
        behaviorAgg.penalized_rounds += behavior.penalized_rounds;
        behaviorAgg.afk_rounds += behavior.afk_rounds;
        behaviorAgg.afk_behavior_rounds += behavior.afk_behavior_rounds;
        behaviorAgg.spawn_camp_rounds += behavior.spawn_camp_rounds;
        behaviorAgg.friendly_fire_out = Math.max(
          behaviorAgg.friendly_fire_out,
          behavior.friendly_fire_out,
        );
      } catch {
        // skip failed match
      }
    }

    const avgAcs = acsCount > 0 ? Math.round(acsSum / acsCount) : 0;
    const avgKda =
      kdaCount > 0 ? Math.round((kdaSum / kdaCount) * 10) / 10 : 0;

    const smurf = computeSmurfScore({
      account_level: player.account_level,
      rank_tier: player.rank_tier,
      recent_games: recentGames,
      win_rate: winRate,
      avg_acs: avgAcs,
      avg_kda: avgKda,
    });

    const suspicious = suspiciousFromBehavior(
      {
        ...behaviorAgg,
        flags: [],
      },
      afkPenalties,
    );

    const profile: PlayerEnrichProfile = {
      name: baseName,
      recent_games: recentGames,
      wins,
      win_rate: winRate,
      avg_acs: avgAcs,
      avg_kda: avgKda,
      afk_penalty_matches: afkPenalties,
      smurf_score: smurf.score,
      smurf_flags: smurf.flags,
      suspicious_score: suspicious.score,
      suspicious_flags: suspicious.flags,
      loaded: true,
      cached: false,
    };

    enrichCache.set(player.subject, { at: Date.now(), profile });
    return profile;
  } catch {
    return { ...empty, name: baseName, loaded: false };
  }
}

export interface EnrichedLivePlayer extends LivePlayer {
  name: string;
  enrich: PlayerEnrichProfile;
}

/** 批量 enrichment（串行 + 间隔，控请求量） */
export async function enrichLivePlayers(
  players: LivePlayer[],
  options?: { delayMs?: number },
): Promise<EnrichedLivePlayer[]> {
  const delay = options?.delayMs ?? 280;
  const subjects = players.map((p) => p.subject).filter(Boolean);
  const nameMap = await resolvePlayerNames(subjects).catch(
    () => new Map<string, string>(),
  );

  const result: EnrichedLivePlayer[] = [];

  for (let i = 0; i < players.length; i++) {
    if (i > 0) await sleep(delay);
    const player = players[i];
    const enrich = await enrichOnePlayer(player, nameMap);
    result.push({
      ...player,
      name: enrich.name,
      enrich,
    });
  }

  return result;
}
