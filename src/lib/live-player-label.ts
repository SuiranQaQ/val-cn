/**
 * 玩家风格标签：菜鸟 / 老板 / NPC / 大神 / 挂
 * 启发式参考，非官方封禁结论
 */

export type PlayerArchetype = "noob" | "boss" | "npc" | "god" | "cheat";

export const ARCHETYPE_LABEL: Record<PlayerArchetype, string> = {
  noob: "菜鸟",
  boss: "老板",
  npc: "NPC",
  god: "大神",
  cheat: "挂?",
};

export const ARCHETYPE_CLASS: Record<PlayerArchetype, string> = {
  noob: "text-lime-300/95 bg-lime-500/12 border-lime-500/25",
  boss: "text-violet-300/95 bg-violet-500/12 border-violet-500/25",
  npc: "text-gray-400 bg-white/5 border-white/10",
  god: "text-amber-300/95 bg-amber-500/12 border-amber-500/30",
  cheat: "text-rose-300/95 bg-rose-500/15 border-rose-500/40",
};

export const ARCHETYPE_TOOLTIP =
  "根据段位、等级与近几场战绩的启发式参考，不等于官方封禁或实锤";

export interface PlayerLabelInput {
  account_level: number;
  rank_tier: number;
  enrich?: {
    loaded?: boolean;
    smurf_score?: number;
    suspicious_score?: number;
    avg_acs?: number;
    avg_kda?: number;
    win_rate?: number;
    recent_games?: number;
  } | null;
}

export interface PlayerArchetypeResult {
  type: PlayerArchetype;
  hint?: string;
}

/** 仅在深度分析完成后打标签，减少误报 */
export function classifyPlayerArchetype(
  input: PlayerLabelInput,
): PlayerArchetypeResult | null {
  const e = input.enrich?.loaded ? input.enrich : null;
  if (!e) return null;

  const level = input.account_level || 0;
  const tier = input.rank_tier || 0;
  const smurf = e.smurf_score ?? 0;
  const sus = e.suspicious_score ?? 0;
  const acs = e.avg_acs ?? 0;
  const kda = e.avg_kda ?? 0;
  const wr = e.win_rate ?? 0;
  const games = e.recent_games ?? 0;

  if (
    sus >= 45 ||
    (smurf >= 50 && sus >= 18) ||
    (games >= 5 && kda >= 3.5 && tier > 0 && tier <= 11 && wr >= 65)
  ) {
    return { type: "cheat", hint: "嫌疑较高，仅供参考" };
  }

  if (
    tier >= 21 ||
    (tier >= 18 && games >= 5 && acs >= 230 && wr >= 52) ||
    (tier >= 15 && games >= 5 && kda >= 1.85 && wr >= 58 && smurf < 25)
  ) {
    return { type: "god", hint: "高段且近期表现强" };
  }

  if (
    (level >= 100 && tier > 0 && tier <= 14 && games >= 3 && kda > 0 && kda < 0.9) ||
    (level >= 120 && tier > 0 && tier <= 17 && games >= 3 && acs > 0 && acs < 155)
  ) {
    return { type: "boss", hint: "高等级低发挥" };
  }

  if (
    (level > 0 && level <= 35 && tier > 0 && tier <= 11 && games >= 3 && wr <= 42) ||
    (games >= 5 && wr <= 32 && kda > 0 && kda < 0.75) ||
    (tier > 0 && tier <= 8 && games >= 3 && kda > 0 && kda < 0.82)
  ) {
    return { type: "noob", hint: "近期数据偏弱" };
  }

  if (games >= 3) {
    return { type: "npc", hint: "表现中规中矩" };
  }

  return null;
}
