import {
  getAgentName,
  getMapName,
  getRankName,
  QUEUE_NAMES,
} from "./constants";
import {
  buildRoundTimeline,
  extractPlayerBehavior,
  type PlayerBehaviorFlags,
  type RoundTimelineEntry,
} from "./match-behavior";

export interface ProcessedPlayer {
  subject: string;
  gameName: string;
  tagLine: string;
  agent_name: string;
  agent_id: string;
  agent_icon?: string;
  team_id: string;
  party_id: string;
  is_me: boolean;
  is_teammate: boolean;
  is_mvp: boolean;
  rank_tier: number;
  rank_name: string;
  rank_icon?: string;
  player_card_id?: string;
  player_card_icon?: string;
  account_level?: number;
  acs: number;
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    score: number;
  };
  hs_rate: string;
  behavior?: PlayerBehaviorFlags;
}

export interface ProcessedMatch {
  match_id: string;
  map_name: string;
  map_id: string;
  queue_name: string;
  queue_id: string;
  game_start: string;
  game_start_ms: number;
  game_length: string;
  total_rounds: number;
  is_win: boolean;
  is_mvp: boolean;
  acs: number;
  hs_rate: string;
  my_team_id: string;
  score: string;
  kda: string;
  agent_name: string;
  agent_icon?: string;
  rank_name: string;
  rank_icon?: string;
  map_icon?: string;
  map_splash?: string;
  teammates: ProcessedPlayer[];
  enemies: ProcessedPlayer[];
  teams: Array<{ teamId: string; roundsWon: number }>;
  round_timeline: RoundTimelineEntry[];
  my_behavior?: PlayerBehaviorFlags;
  raw: unknown;
}

function formatDuration(ms: number): string {
  if (!ms) return "-";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTime(ms: number): string {
  if (!ms) return "未知时间";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "未知时间";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcHeadshotRate(
  player: Record<string, unknown>,
  roundResults: Array<Record<string, unknown>>,
): string {
  const subject = String(player.subject || player.Subject || "");
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;

  for (const round of roundResults) {
    const stats = round.playerStats as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(stats)) continue;
    const ps = stats.find((s) => String(s.subject) === subject);
    if (!ps?.damage) continue;
    const damage = ps.damage as Array<Record<string, unknown>>;
    for (const d of damage) {
      // 国服/新版接口：headshots / bodyshots / legshots 为命中次数
      if (
        d.headshots != null ||
        d.bodyshots != null ||
        d.legshots != null
      ) {
        headshots += Number(d.headshots || 0);
        bodyshots += Number(d.bodyshots || 0);
        legshots += Number(d.legshots || 0);
        continue;
      }
      // 旧版接口：hitLocation + numHits
      const loc = String(d.hitLocation || "");
      const hits = Number(d.numHits || 0);
      if (loc === "HEAD") headshots += hits;
      else if (loc === "LEGS") legshots += hits;
      else bodyshots += hits;
    }
  }

  const total = headshots + bodyshots + legshots;
  if (!total) return "-";
  return `${Math.round((headshots / total) * 100)}%`;
}

function calcAcs(score: number, rounds: number): number {
  if (!rounds) return 0;
  return Math.round(score / rounds);
}

function processPlayer(
  player: Record<string, unknown>,
  subject: string,
  myTeamId: string,
  roundResults: Array<Record<string, unknown>>,
  topScore: number,
  totalRounds: number,
): ProcessedPlayer {
  const pSubject = String(player.subject || player.Subject || "");
  const stats = (player.stats || {}) as Record<string, number>;
  const teamId = String(player.teamId || player.team_id || "");
  const score = Number(stats.score || 0);
  const behavior = extractPlayerBehavior(player, roundResults);

  return {
    subject: pSubject,
    gameName: String(player.gameName || player.GameName || "未知"),
    tagLine: String(player.tagLine || player.TagLine || ""),
    agent_name: getAgentName(
      String(player.characterId || player.character_id || ""),
    ),
    agent_id: String(player.characterId || player.character_id || ""),
    team_id: teamId,
    party_id: String(player.partyId || player.party_id || ""),
    is_me: pSubject === subject,
    is_teammate: teamId === myTeamId && pSubject !== subject,
    is_mvp: score > 0 && score >= topScore,
    rank_tier: Number(player.competitiveTier || 0),
    rank_name: getRankName(Number(player.competitiveTier || 0)),
    player_card_id: String(
      player.playerCard || player.playerCardId || "",
    ),
    account_level: Number(player.accountLevel || 0) || undefined,
    acs: calcAcs(score, totalRounds),
    stats: {
      kills: Number(stats.kills || 0),
      deaths: Number(stats.deaths || 0),
      assists: Number(stats.assists || 0),
      score,
    },
    hs_rate: calcHeadshotRate(player, roundResults),
    behavior,
  };
}

export function processMatchDetail(
  matchId: string,
  raw: Record<string, unknown>,
  subject: string,
): ProcessedMatch {
  const matchInfo = (raw.matchInfo || raw.match_info || {}) as Record<
    string,
    unknown
  >;
  const players = (raw.players || []) as Array<Record<string, unknown>>;
  const teams = (raw.teams || []) as Array<Record<string, unknown>>;
  const roundResults = (raw.roundResults ||
    raw.round_results ||
    []) as Array<Record<string, unknown>>;

  const me = players.find(
    (p) => String(p.subject || p.Subject) === subject,
  );
  const myTeamId = String(me?.teamId || me?.team_id || "");
  const topScore = Math.max(
    ...players.map((p) => Number((p.stats as Record<string, number>)?.score || 0)),
    0,
  );

  const processedTeams = teams.map((t) => ({
    teamId: String(t.teamId || t.team_id || ""),
    roundsWon: Number(t.roundsWon || t.rounds_won || 0),
  }));

  const myTeam = processedTeams.find((t) => t.teamId === myTeamId);
  const enemyTeam = processedTeams.find((t) => t.teamId !== myTeamId);
  const isWin =
    myTeam && enemyTeam ? myTeam.roundsWon > enemyTeam.roundsWon : false;

  const totalRounds =
    processedTeams.reduce((sum, t) => sum + t.roundsWon, 0) ||
    roundResults.length ||
    1;

  const teammates = players
    .filter((p) => String(p.teamId || p.team_id) === myTeamId)
    .map((p) =>
      processPlayer(
        p,
        subject,
        myTeamId,
        roundResults,
        topScore,
        totalRounds,
      ),
    );

  const enemies = players
    .filter((p) => String(p.teamId || p.team_id) !== myTeamId)
    .map((p) =>
      processPlayer(
        p,
        subject,
        myTeamId,
        roundResults,
        topScore,
        totalRounds,
      ),
    );

  const meProcessed = teammates.find((p) => p.is_me);
  const queueId = String(
    matchInfo.queueId || matchInfo.queueID || matchInfo.queue_id || "",
  );
  const gameStartMs = Number(
    matchInfo.gameStartMillis || matchInfo.game_start_millis || 0,
  );

  return {
    match_id: matchId,
    map_name: getMapName(
      String(matchInfo.mapId || matchInfo.mapID || matchInfo.map_id || ""),
    ),
    map_id: String(matchInfo.mapId || matchInfo.mapID || ""),
    queue_name: QUEUE_NAMES[queueId] || queueId || "未知模式",
    queue_id: queueId,
    game_start: formatTime(gameStartMs),
    game_start_ms: gameStartMs,
    game_length: formatDuration(
      Number(matchInfo.gameLengthMillis || matchInfo.game_length_millis || 0),
    ),
    total_rounds: totalRounds,
    is_win: isWin,
    is_mvp: !!meProcessed?.is_mvp,
    acs: meProcessed?.acs ?? 0,
    hs_rate: meProcessed?.hs_rate ?? "-",
    my_team_id: myTeamId,
    score:
      myTeam && enemyTeam
        ? `${myTeam.roundsWon} : ${enemyTeam.roundsWon}`
        : "-",
    kda: meProcessed
      ? `${meProcessed.stats.kills}/${meProcessed.stats.deaths}/${meProcessed.stats.assists}`
      : "-",
    agent_name: meProcessed?.agent_name || "-",
    rank_name: meProcessed?.rank_name || "-",
    teammates,
    enemies,
    teams: processedTeams,
    round_timeline: buildRoundTimeline(roundResults, subject),
    my_behavior: meProcessed?.behavior,
    raw,
  };
}
