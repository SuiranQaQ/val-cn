export interface PlayerBehaviorFlags {
  penalized_rounds: number;
  afk_rounds: number;
  afk_behavior_rounds: number;
  spawn_camp_rounds: number;
  friendly_fire_out: number;
  flags: string[];
}

export interface RoundTimelineEntry {
  round: number;
  result: string;
  winning_team: string;
  my_kills: number;
  my_deaths: number;
  ceremony: string;
}

function behaviorFlagsFromCounts(
  penalized: number,
  afkRounds: number,
  afkBehavior: number,
  spawnCamp: number,
  ffOut: number,
): string[] {
  const flags: string[] = [];
  if (penalized > 0) flags.push(`局内处罚回合×${penalized}`);
  if (afkRounds > 0) flags.push(`回合AFK×${afkRounds}`);
  if (afkBehavior >= 2) flags.push(`行为AFK×${afkBehavior}`);
  if (spawnCamp >= 2) flags.push(`出生点挂机×${spawnCamp}`);
  if (ffOut > 0.15) flags.push("高友伤");
  return flags;
}

export function extractPlayerBehavior(
  player: Record<string, unknown>,
  roundResults: Array<Record<string, unknown>>,
): PlayerBehaviorFlags {
  const subject = String(player.subject || player.Subject || "");
  let penalized = 0;
  let afkRounds = 0;

  for (const round of roundResults) {
    const stats = round.playerStats as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(stats)) continue;
    const ps = stats.find((s) => String(s.subject) === subject);
    if (!ps) continue;
    if (ps.wasPenalized) penalized += 1;
    if (ps.wasAfk) afkRounds += 1;
  }

  const bf = (player.behaviorFactors || {}) as Record<string, number>;
  const afkBehavior = Number(bf.afkRounds || 0);
  const spawnCamp = Number(bf.stayedInSpawnRounds || 0);
  const ffOut = Number(bf.friendlyFireOutgoing || 0);

  return {
    penalized_rounds: penalized,
    afk_rounds: afkRounds,
    afk_behavior_rounds: afkBehavior,
    spawn_camp_rounds: spawnCamp,
    friendly_fire_out: ffOut,
    flags: behaviorFlagsFromCounts(
      penalized,
      afkRounds,
      afkBehavior,
      spawnCamp,
      ffOut,
    ),
  };
}

export function buildRoundTimeline(
  roundResults: Array<Record<string, unknown>>,
  mySubject: string,
): RoundTimelineEntry[] {
  return roundResults.map((round, index) => {
    const stats = round.playerStats as Array<Record<string, unknown>> | undefined;
    const ps = Array.isArray(stats)
      ? stats.find((s) => String(s.subject) === mySubject)
      : undefined;

    let myKills = 0;
    let myDeaths = 0;
    const kills = ps?.kills as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(kills)) {
      myKills = kills.filter(
        (k) => String(k.killer) === mySubject,
      ).length;
    }

    if (Array.isArray(stats)) {
      for (const s of stats) {
        const kList = s.kills as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(kList)) continue;
        for (const k of kList) {
          if (String(k.victim) === mySubject) myDeaths += 1;
        }
      }
    }

    return {
      round: Number(round.roundNum ?? index),
      result: String(round.roundResult || round.roundResultCode || "-"),
      winning_team: String(round.winningTeam || "-"),
      my_kills: myKills,
      my_deaths: myDeaths,
      ceremony: String(round.roundCeremony || ""),
    };
  });
}
