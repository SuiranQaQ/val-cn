/** 炸鱼风险启发式评分（0–100，非官方判定） */

const ACS_EXPECTED: Record<string, number> = {
  low: 180,
  mid: 210,
  high: 245,
};

function tierBand(tier: number): "low" | "mid" | "high" {
  if (tier <= 8) return "low";
  if (tier <= 17) return "mid";
  return "high";
}

export function computeSmurfScore(input: {
  account_level: number;
  rank_tier: number;
  recent_games: number;
  win_rate: number;
  avg_acs: number;
  avg_kda: number;
}): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const { account_level, rank_tier, recent_games, win_rate, avg_acs, avg_kda } =
    input;

  if (account_level > 0 && account_level < 40 && rank_tier >= 15) {
    score += 28;
    flags.push(`低等级(${account_level})高段位`);
  } else if (account_level > 0 && account_level < 80 && rank_tier >= 21) {
    score += 22;
    flags.push("等级与超凡+不匹配");
  }

  const expected = ACS_EXPECTED[tierBand(rank_tier)];
  if (avg_acs > 0 && avg_acs >= expected + 55) {
    score += 24;
    flags.push(`ACS ${avg_acs} 高于段位常态`);
  } else if (avg_acs > 0 && avg_acs >= expected + 35) {
    score += 14;
    flags.push("近期 ACS 偏高");
  }

  if (recent_games >= 3 && win_rate >= 75) {
    score += 18;
    flags.push(`近${recent_games}场胜率 ${win_rate}%`);
  } else if (recent_games >= 5 && win_rate >= 65) {
    score += 10;
    flags.push("胜率偏高");
  }

  if (avg_kda >= 2.2 && rank_tier <= 11) {
    score += 12;
    flags.push(`KDA ${avg_kda.toFixed(1)} 与低段位不符`);
  }

  if (recent_games > 0 && recent_games <= 8 && win_rate >= 60 && avg_acs >= 230) {
    score += 10;
    flags.push("新号高表现");
  }

  return {
    score: Math.min(100, score),
    flags,
  };
}
