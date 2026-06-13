import {
  getAgentDisplay,
  getPlayerCardDisplay,
  getRankDisplay,
} from "./game-assets";
import type { LivePlayer } from "./live-match";

/** 附加头像、特工立绘、段位图标（valorant-api.com） */
export async function enrichLivePlayersVisual(
  players: LivePlayer[],
): Promise<LivePlayer[]> {
  const agentIds = [...new Set(players.map((p) => p.agent_id).filter(Boolean))];
  const cardIds = [
    ...new Set(players.map((p) => p.player_card_id).filter(Boolean)),
  ];
  const tiers = [...new Set(players.map((p) => p.rank_tier).filter(Boolean))];

  const agentMap = new Map<string, Awaited<ReturnType<typeof getAgentDisplay>>>();
  const cardMap = new Map<
    string,
    Awaited<ReturnType<typeof getPlayerCardDisplay>>
  >();
  const rankMap = new Map<number, Awaited<ReturnType<typeof getRankDisplay>>>();

  await Promise.all([
    ...agentIds.map(async (id) => {
      agentMap.set(id, await getAgentDisplay(id));
    }),
    ...cardIds.map(async (id) => {
      cardMap.set(id, await getPlayerCardDisplay(id));
    }),
    ...tiers.map(async (tier) => {
      rankMap.set(tier, await getRankDisplay(tier));
    }),
  ]);

  return players.map((p) => {
    const agent = p.agent_id ? agentMap.get(p.agent_id) : null;
    const card = p.player_card_id ? cardMap.get(p.player_card_id) : null;
    const rank = p.rank_tier ? rankMap.get(p.rank_tier) : null;
    return {
      ...p,
      agent_name: agent?.name || p.agent_name,
      agent_icon: agent?.icon,
      player_card_art: card?.smallArt || card?.wideArt,
      rank_icon: rank?.icon,
      rank_name: rank?.name || p.rank_name,
    };
  });
}
