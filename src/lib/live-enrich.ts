/**
 * 对局玩家远程 enrichment：名字、近期战绩、炸鱼分、可疑行为
 * 带内存缓存与请求节流，降低限流风险
 */

import { computeSmurfScore } from "./smurf-score";
import { getRankName } from "./constants";
import type { LivePlayer } from "./live-match";
import { extractPlayerBehavior } from "./match-behavior";
import { processMatchDetail, type ProcessedMatch } from "./match-processor";
import { computeRecentSummary } from "./stats";
import {
  fetchCompetitiveUpdates,
  fetchMatchDetail,
  fetchPlayerHistory,
  resolvePlayerNames,
} from "./riot";

export interface PlayerEnrichProfile {
  name: string;
  recent_games: number;
  wins: number;
  win_rate: number;
  avg_acs: number;
  avg_kda: number;
  avg_kd: number;
  headshot_pct: number;
  rank_tier: number;
  afk_penalty_matches: number;
  smurf_score: number;
  smurf_flags: string[];
  suspicious_score: number;
  suspicious_flags: string[];
  /** 胜率统计范围说明，如「近6场」 */
  stats_scope: string;
  loaded: boolean;
  cached: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const enrichCache = new Map<string, { at: number; profile: PlayerEnrichProfile }>();
const RECENT_HISTORY_SIZE = 10;
const RECENT_DETAIL_LIMIT = 6;
const DETAIL_FETCH_GAP_MS = 90;

/** 死斗/乱斗等无胜负意义模式，不计入胜率 */
const NON_WIN_RATE_QUEUES = new Set([
  "deathmatch",
  "ggteam",
  "hurm",
  "gungame",
]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseHsRate(value: string): number | null {
  const n = Number(String(value || "").replace("%", "").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isWinRateEligible(match: ProcessedMatch): boolean {
  const queue = (match.queue_id || "").toLowerCase();
  if (NON_WIN_RATE_QUEUES.has(queue)) return false;
  return match.teams.length >= 2;
}

async function loadRecentProcessedMatches(
  subject: string,
): Promise<ProcessedMatch[]> {
  const history = (await fetchPlayerHistory(
    subject,
    0,
    RECENT_HISTORY_SIZE,
  ).catch(() => null)) as Record<string, unknown> | null;

  const ids = (
    (history?.History || history?.history || []) as Array<Record<string, unknown>>
  )
    .map((row) => String(row.MatchID || row.matchId || "").trim())
    .filter(Boolean)
    .slice(0, RECENT_DETAIL_LIMIT);

  const processed: ProcessedMatch[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (i > 0) await sleep(DETAIL_FETCH_GAP_MS);
    try {
      const raw = (await fetchMatchDetail(ids[i])) as Record<string, unknown>;
      processed.push(processMatchDetail(ids[i], raw, subject));
    } catch {
      // skip unavailable match (刚结束的可能短暂 404)
    }
  }
  return processed;
}

function summarizeRecentStats(processed: ProcessedMatch[]) {
  const winPool = processed.filter(isWinRateEligible);
  const summary = computeRecentSummary(winPool.length ? winPool : processed);

  let kdSum = 0;
  let kdCount = 0;
  let kdaSum = 0;
  let kdaCount = 0;
  let hsSum = 0;
  let hsCount = 0;

  for (const match of processed) {
    const me = match.teammates.find((p) => p.is_me);
    if (!me) continue;

    const { kills, deaths, assists } = me.stats;
    kdaSum += deaths > 0 ? (kills + assists) / deaths : kills + assists;
    kdaCount += 1;
    if (deaths > 0) {
      kdSum += kills / deaths;
      kdCount += 1;
    }

    const hs = parseHsRate(me.hs_rate);
    if (hs != null) {
      hsSum += hs;
      hsCount += 1;
    }
  }

  const scopeCount = winPool.length || processed.length;
  const statsScope =
    scopeCount > 0
      ? winPool.length && winPool.length < processed.length
        ? `近${scopeCount}场(含模式)`
        : `近${scopeCount}场`
      : "暂无战绩";

  return {
    recent_games: summary.total,
    wins: summary.wins,
    win_rate: summary.winRate,
    avg_acs: summary.avgAcs,
    avg_kda:
      kdaCount > 0 ? Math.round((kdaSum / kdaCount) * 10) / 10 : 0,
    avg_kd: kdCount > 0 ? Math.round((kdSum / kdCount) * 10) / 10 : 0,
    headshot_pct: hsCount > 0 ? Math.round(hsSum / hsCount) : 0,
    stats_scope: statsScope,
  };
}

function aggregateBehavior(processed: ProcessedMatch[]) {
  const behaviorAgg = {
    penalized_rounds: 0,
    afk_rounds: 0,
    afk_behavior_rounds: 0,
    spawn_camp_rounds: 0,
    friendly_fire_out: 0,
    flags: [] as string[],
  };

  for (const match of processed) {
    const me = match.teammates.find((p) => p.is_me);
    if (!me?.behavior) continue;
    behaviorAgg.penalized_rounds += me.behavior.penalized_rounds;
    behaviorAgg.afk_rounds += me.behavior.afk_rounds;
    behaviorAgg.afk_behavior_rounds += me.behavior.afk_behavior_rounds;
    behaviorAgg.spawn_camp_rounds += me.behavior.spawn_camp_rounds;
    behaviorAgg.friendly_fire_out = Math.max(
      behaviorAgg.friendly_fire_out,
      me.behavior.friendly_fire_out,
    );
  }

  return behaviorAgg;
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
    avg_kd: 0,
    headshot_pct: 0,
    rank_tier: 0,
    afk_penalty_matches: 0,
    smurf_score: 0,
    smurf_flags: [],
    suspicious_score: 0,
    suspicious_flags: [],
    stats_scope: "暂无战绩",
    loaded: false,
    cached: false,
  };

  try {
    const [processed, updatesRes] = await Promise.all([
      loadRecentProcessedMatches(player.subject),
      fetchCompetitiveUpdates(player.subject, 10).catch(() => null),
    ]);

    const updates = (updatesRes || {}) as Record<string, unknown>;
    const competitiveMatches = (updates?.Matches || []) as Array<
      Record<string, unknown>
    >;

    let afkPenalties = 0;
    let rankTierFromUpdates = 0;
    for (const m of competitiveMatches) {
      if (Number(m.AFKPenalty || 0) > 0) afkPenalties += 1;
      const tier = Number(m.TierAfterUpdate ?? m.tierAfterUpdate ?? 0);
      if (tier > 0 && !rankTierFromUpdates) rankTierFromUpdates = tier;
    }

    for (const match of processed) {
      const me = match.teammates.find((p) => p.is_me);
      if (me && me.rank_tier > rankTierFromUpdates) {
        rankTierFromUpdates = me.rank_tier;
      }
    }

    const stats = summarizeRecentStats(processed);
    const behaviorAgg = aggregateBehavior(processed);

    const smurf = computeSmurfScore({
      account_level: player.account_level,
      rank_tier: player.rank_tier,
      recent_games: stats.recent_games,
      win_rate: stats.win_rate,
      avg_acs: stats.avg_acs,
      avg_kda: stats.avg_kda,
    });

    const suspicious = suspiciousFromBehavior(behaviorAgg, afkPenalties);

    const profile: PlayerEnrichProfile = {
      name: baseName,
      ...stats,
      rank_tier: rankTierFromUpdates,
      afk_penalty_matches: afkPenalties,
      smurf_score: smurf.score,
      smurf_flags: smurf.flags,
      suspicious_score: suspicious.score,
      suspicious_flags: suspicious.flags,
      loaded: processed.length > 0,
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
    const rankTier = Math.max(player.rank_tier, enrich.rank_tier || 0);
    result.push({
      ...player,
      rank_tier: rankTier,
      rank_name: getRankName(rankTier),
      name: enrich.name,
      enrich,
    });
  }

  return result;
}
