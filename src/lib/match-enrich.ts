import {
  getAgentDisplay,
  getMapDisplay,
  getPlayerCardDisplay,
  getRankDisplay,
} from "./game-assets";
import type { ProcessedMatch, ProcessedPlayer } from "./match-processor";
import { resolvePlayerNames } from "./riot";

function needsNameResolve(p: ProcessedPlayer): boolean {
  if (!p.subject) return false;
  const gn = p.gameName.trim();
  return !gn || gn === "未知" || !p.tagLine.trim();
}

function applyName(
  p: ProcessedPlayer,
  names: Map<string, string>,
): ProcessedPlayer {
  if (!needsNameResolve(p)) return p;
  const full = names.get(p.subject);
  if (!full) return p;
  const hash = full.lastIndexOf("#");
  if (hash <= 0) return { ...p, gameName: full };
  return {
    ...p,
    gameName: full.slice(0, hash),
    tagLine: full.slice(hash + 1),
  };
}

async function enrichPlayerAssets(p: ProcessedPlayer): Promise<ProcessedPlayer> {
  const [agent, rank, card] = await Promise.all([
    p.agent_id ? getAgentDisplay(p.agent_id) : null,
    p.rank_tier ? getRankDisplay(p.rank_tier) : null,
    p.player_card_id ? getPlayerCardDisplay(p.player_card_id) : null,
  ]);
  return {
    ...p,
    agent_name: agent?.name || p.agent_name,
    agent_icon: agent?.icon,
    rank_name: rank?.name || p.rank_name,
    rank_icon: rank?.icon,
    player_card_icon: card?.smallArt,
  };
}

/** 批量把 UUID 解析成 Name#Tag，并挂上官方配图 */
export async function enrichMatches(
  matches: ProcessedMatch[],
): Promise<ProcessedMatch[]> {
  const subjects = new Set<string>();
  for (const m of matches) {
    for (const p of [...m.teammates, ...m.enemies]) {
      if (needsNameResolve(p)) subjects.add(p.subject);
    }
  }

  let nameMap = new Map<string, string>();
  if (subjects.size > 0) {
    try {
      nameMap = await resolvePlayerNames([...subjects]);
    } catch {
      // 名字解析失败时保留 UUID
    }
  }

  const enriched: ProcessedMatch[] = [];
  for (const m of matches) {
    const teammates = m.teammates.map((p) => applyName(p, nameMap));
    const enemies = m.enemies.map((p) => applyName(p, nameMap));

    const mapAsset = m.map_id ? await getMapDisplay(m.map_id) : null;

    const withPlayers: ProcessedMatch = {
      ...m,
      map_name: mapAsset?.name || m.map_name,
      map_icon: mapAsset?.listIcon,
      map_splash: mapAsset?.splash,
      teammates: await Promise.all(teammates.map(enrichPlayerAssets)),
      enemies: await Promise.all(enemies.map(enrichPlayerAssets)),
    };

    const me = withPlayers.teammates.find((p) => p.is_me);
    if (me) {
      withPlayers.agent_name = me.agent_name;
      withPlayers.agent_icon = me.agent_icon;
      withPlayers.rank_name = me.rank_name;
      withPlayers.rank_icon = me.rank_icon;
    }

    enriched.push(withPlayers);
  }

  return enriched;
}
