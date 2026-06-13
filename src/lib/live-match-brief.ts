/**
 * 对局简报：阵容职能统计、段位对比、风险摘要
 */

import {
  AGENT_ROLE_ORDER,
  AGENT_ROLE_SHORT,
  emptyRoleCounts,
  type AgentRole,
} from "./agent-roles";
import { getRankName } from "./constants";

export interface BriefPlayer {
  subject: string;
  agent_id: string;
  agent_name: string;
  rank_tier: number;
  rank_name: string;
  is_ally: boolean;
  enrich?: {
    loaded?: boolean;
    name?: string;
    smurf_score?: number;
    smurf_flags?: string[];
    suspicious_score?: number;
    suspicious_flags?: string[];
  } | null;
}

export interface TeamCompSide {
  counts: Record<AgentRole, number>;
  picked: number;
  gaps: string[];
  summary: string;
}

export interface RankCompareSide {
  avgTier: number;
  avgLabel: string;
  count: number;
}

export interface LiveMatchBrief {
  allyComp: TeamCompSide;
  enemyComp: TeamCompSide;
  rankCompare: {
    ally: RankCompareSide;
    enemy: RankCompareSide;
    delta: number;
    deltaLabel: string;
  } | null;
  risk: {
    lines: string[];
    enemySmurfCount: number;
    enemySusCount: number;
    allySmurfCount: number;
    analyzed: number;
    total: number;
  };
}

function countRoles(
  players: BriefPlayer[],
  roleByAgentId: Map<string, AgentRole>,
): Record<AgentRole, number> {
  const counts = emptyRoleCounts();
  for (const p of players) {
    if (!p.agent_id) continue;
    const role = roleByAgentId.get(p.agent_id.toLowerCase());
    if (role) counts[role] += 1;
  }
  return counts;
}

function compGaps(counts: Record<AgentRole, number>, picked: number): string[] {
  if (picked === 0) return [];
  const gaps: string[] = [];
  if (counts.controller === 0) gaps.push("缺控场");
  if (counts.sentinel === 0) gaps.push("缺哨位");
  if (counts.initiator === 0) gaps.push("缺先锋");
  return gaps;
}

function formatCompSummary(counts: Record<AgentRole, number>): string {
  return AGENT_ROLE_ORDER.map(
    (r) => `${AGENT_ROLE_SHORT[r]}${counts[r]}`,
  ).join(" · ");
}

function rankSide(players: BriefPlayer[]): RankCompareSide | null {
  const tiers = players.map((p) => p.rank_tier).filter((t) => t > 0);
  if (!tiers.length) return null;
  const avgTier = Math.round(
    tiers.reduce((a, b) => a + b, 0) / tiers.length,
  );
  return {
    avgTier,
    avgLabel: getRankName(avgTier),
    count: tiers.length,
  };
}

function playerLabel(p: BriefPlayer): string {
  return p.enrich?.name || p.agent_name || p.subject.slice(0, 6);
}

export function buildLiveMatchBrief(
  players: BriefPlayer[],
  roleByAgentId: Map<string, AgentRole>,
): LiveMatchBrief {
  const allies = players.filter((p) => p.is_ally);
  const enemies = players.filter((p) => !p.is_ally);

  const allyCounts = countRoles(allies, roleByAgentId);
  const enemyCounts = countRoles(enemies, roleByAgentId);
  const allyPicked = allies.filter((p) => p.agent_id).length;
  const enemyPicked = enemies.filter((p) => p.agent_id).length;

  const allyComp: TeamCompSide = {
    counts: allyCounts,
    picked: allyPicked,
    gaps: compGaps(allyCounts, allyPicked),
    summary: formatCompSummary(allyCounts),
  };
  const enemyComp: TeamCompSide = {
    counts: enemyCounts,
    picked: enemyPicked,
    gaps: compGaps(enemyCounts, enemyPicked),
    summary: formatCompSummary(enemyCounts),
  };

  const allyRank = rankSide(allies);
  const enemyRank = rankSide(enemies);
  let rankCompare: LiveMatchBrief["rankCompare"] = null;
  if (allyRank && enemyRank) {
    const delta = allyRank.avgTier - enemyRank.avgTier;
    const deltaLabel =
      delta === 0
        ? "双方段位相当"
        : delta > 0
          ? `己方平均高 ${Math.abs(delta)} 档`
          : `敌方平均高 ${Math.abs(delta)} 档`;
    rankCompare = { ally: allyRank, enemy: enemyRank, delta, deltaLabel };
  }

  const loaded = players.filter((p) => p.enrich?.loaded);
  const analyzed = loaded.length;
  const total = players.length;

  const enemySmurf = loaded.filter(
    (p) => !p.is_ally && (p.enrich?.smurf_score ?? 0) >= 28,
  );
  const enemySus = loaded.filter(
    (p) => !p.is_ally && (p.enrich?.suspicious_score ?? 0) >= 12,
  );
  const allySmurf = loaded.filter(
    (p) => p.is_ally && (p.enrich?.smurf_score ?? 0) >= 28,
  );

  const lines: string[] = [];

  if (analyzed === 0) {
    lines.push("深度分析完成后显示风险摘要");
  } else {
    if (enemySmurf.length) {
      lines.push(
        `敌方 ${enemySmurf.length} 人炸鱼嫌疑：${enemySmurf.map(playerLabel).join("、")}`,
      );
    }
    if (enemySus.length) {
      lines.push(
        `敌方 ${enemySus.length} 人行为可疑：${enemySus.map(playerLabel).join("、")}`,
      );
    }
    if (allySmurf.length) {
      lines.push(
        `己方 ${allySmurf.length} 人炸鱼嫌疑（可能是小号）：${allySmurf.map(playerLabel).join("、")}`,
      );
    }
    if (!enemySmurf.length && !enemySus.length && !allySmurf.length) {
      lines.push("暂未发现明显炸鱼或可疑行为（基于近几场战绩）");
    }
  }

  if (enemyComp.picked > 0 && enemyComp.gaps.length) {
    lines.push(`敌方阵容：${enemyComp.gaps.join("、")}`);
  }
  if (allyComp.picked > 0 && allyComp.gaps.length) {
    lines.push(`己方阵容：${allyComp.gaps.join("、")}`);
  }

  return {
    allyComp,
    enemyComp,
    rankCompare,
    risk: {
      lines,
      enemySmurfCount: enemySmurf.length,
      enemySusCount: enemySus.length,
      allySmurfCount: allySmurf.length,
      analyzed,
      total,
    },
  };
}
