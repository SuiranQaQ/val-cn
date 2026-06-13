/**
 * 行为防护：红屏 / 行为异常 / 局内处罚
 * - restrictions/v3/penalties：当前账号限制
 * - restrictions/v1/interventionFeedback/{matchId}：本局被系统标记的违规类型（不含举报人）
 */

import { extractPlayerBehavior } from "./match-behavior";
import { processMatchDetail, type ProcessedMatch } from "./match-processor";
import { fetchInterventionFeedback, fetchMatchDetail, fetchPenalties } from "./riot";
import { parsePenalties, type PenaltySummary } from "./player-profile";

export interface FlaggedSubject {
  subject: string;
  infractions: string[];
  infraction_labels: string[];
}

export interface InterventionFeedback {
  match_id: string;
  flagged: FlaggedSubject[];
  me_flagged: FlaggedSubject | null;
  others_flagged: FlaggedSubject[];
}

export interface MatchBehaviorReview {
  match_id: string;
  map_name: string;
  queue_name: string;
  is_win: boolean;
  score: string;
  my_flags: string[];
  my_behavior_factors: Record<string, number>;
  penalized_rounds: number;
  afk_rounds: number;
}

export interface BehaviorGuardStatus {
  penalties: PenaltySummary;
  intervention: InterventionFeedback | null;
  last_match: MatchBehaviorReview | null;
  risk_level: "ok" | "warn" | "danger";
  risk_lines: string[];
  tips: string[];
  note_reporter: string;
}

const INFRACTION_LABELS: Record<string, string> = {
  AFK: "挂机 / 未参与",
  Afk: "挂机 / 未参与",
  QUEUEDODGE: "排队 dodge / 选人退出",
  QueueDodge: "排队 dodge / 选人退出",
  DODGE: "排队 dodge",
  Dodge: "排队 dodge",
  FRIENDLYFIRE: "打队友",
  FriendlyFire: "打队友",
  COMMSTOXICITY: "语音/文字骚扰",
  CommsToxicity: "语音/文字骚扰",
  TEXTTOXICITY: "文字骚扰",
  TextToxicity: "文字骚扰",
  DISRUPTIVE: "破坏对局",
  Disruptive: "破坏对局",
  BOT: "疑似脚本/挂机",
  Bot: "疑似脚本/挂机",
  INACTIVITY: "长时间不操作",
  Inactivity: "长时间不操作",
  SPAWN_CAMPING: "出生点挂机",
};

const GUARD_TIPS = [
  "官方不会告知「谁举报了你」，只能看到系统判定的违规类型。",
  "行为分按账号历史累计，偶尔断线通常只警告，频繁挂机才会触发 1 天竞技限制。",
  "长时间不动、整回合不参与、出生点挂机，都容易被标 Afk。",
  "选人阶段退出或断线会被记 Queue Dodge，Repeated 会扣更多 RR。",
  "打队友、恶意摆烂也会进入行为检测，和挂机共用累计评分。",
];

function labelInfraction(raw: string): string {
  const key = raw.trim();
  if (!key) return "未知违规";
  return (
    INFRACTION_LABELS[key] ||
    INFRACTION_LABELS[key.toUpperCase()] ||
    key
  );
}

function parseIntervention(
  matchId: string,
  raw: Record<string, unknown> | null,
  mySubject: string,
): InterventionFeedback | null {
  if (!raw) return null;

  const flaggedRaw = (raw.FlaggedSubjects || raw.flaggedSubjects || []) as Array<
    Record<string, unknown>
  >;
  if (!flaggedRaw.length) return null;

  const flagged: FlaggedSubject[] = flaggedRaw.map((row) => {
    const infractions = (
      (row.Infractions || row.infractions || []) as unknown[]
    ).map((v) => String(v));
    return {
      subject: String(row.Subject || row.subject || ""),
      infractions,
      infraction_labels: infractions.map(labelInfraction),
    };
  });

  const meLower = mySubject.toLowerCase();
  const me_flagged =
    flagged.find((f) => f.subject.toLowerCase() === meLower) || null;
  const others_flagged = flagged.filter(
    (f) => f.subject.toLowerCase() !== meLower,
  );

  return {
    match_id: String(raw.MatchID || raw.matchId || matchId),
    flagged,
    me_flagged,
    others_flagged,
  };
}

function behaviorReviewFromMatch(
  match: ProcessedMatch,
): MatchBehaviorReview {
  const me = match.teammates.find((p) => p.is_me);
  const raw = match.raw as Record<string, unknown> | undefined;
  const players = (raw?.players || []) as Array<Record<string, unknown>>;
  const rounds = (raw?.roundResults || raw?.round_results || []) as Array<
    Record<string, unknown>
  >;
  const meRaw = players.find((p) => String(p.subject) === me?.subject);
  const behavior = meRaw ? extractPlayerBehavior(meRaw, rounds) : null;
  const bf = ((meRaw?.behaviorFactors || {}) as Record<string, number>) || {};

  return {
    match_id: match.match_id,
    map_name: match.map_name,
    queue_name: match.queue_name,
    is_win: match.is_win,
    score: match.score,
    my_flags: behavior?.flags || [],
    my_behavior_factors: bf,
    penalized_rounds: behavior?.penalized_rounds || 0,
    afk_rounds: behavior?.afk_rounds || 0,
  };
}

function assessRisk(
  penalties: PenaltySummary,
  intervention: InterventionFeedback | null,
  lastMatch: MatchBehaviorReview | null,
): { level: BehaviorGuardStatus["risk_level"]; lines: string[] } {
  const lines: string[] = [];

  if (penalties.has_active) {
    for (const p of penalties.items) {
      const exp = p.expires_at
        ? ` · 至 ${new Date(p.expires_at).toLocaleString("zh-CN")}`
        : "";
      lines.push(`当前限制：${p.type}${p.reason ? `（${p.reason}）` : ""}${exp}`);
    }
    return { level: "danger", lines };
  }

  if (intervention?.me_flagged) {
    lines.push(
      `上局被系统标记：${intervention.me_flagged.infraction_labels.join("、")}`,
    );
    return { level: "warn", lines };
  }

  if (lastMatch) {
    if (lastMatch.penalized_rounds > 0) {
      lines.push(`上局有 ${lastMatch.penalized_rounds} 个回合被记「局内处罚」`);
    }
    if (lastMatch.afk_rounds > 0) {
      lines.push(`上局有 ${lastMatch.afk_rounds} 个回合被记 AFK`);
    }
    const spawn = Number(lastMatch.my_behavior_factors.stayedInSpawnRounds || 0);
    if (spawn >= 0.5) {
      lines.push(`上局出生点停留偏多（${spawn.toFixed(1)}），有挂机嫌疑`);
    }
    const afkBf = Number(lastMatch.my_behavior_factors.afkRounds || 0);
    if (afkBf >= 0.2) {
      lines.push(`官方行为分：AFK 倾向 ${Math.round(afkBf * 100)}%`);
    }
  }

  if (intervention?.others_flagged.length) {
    lines.push(
      `同局另有 ${intervention.others_flagged.length} 人被标记：${intervention.others_flagged
        .map((o) => o.infraction_labels.join("/"))
        .join("；")}`,
    );
  }

  if (!lines.length) {
    lines.push("近期未检测到行为限制或上局违规标记");
    return { level: "ok", lines };
  }

  const level =
    lines.some((l) => l.includes("被系统标记") || l.includes("局内处罚"))
      ? "warn"
      : "ok";
  return { level, lines };
}

export async function fetchBehaviorGuardStatus(input: {
  mySubject: string;
  matchId?: string;
}): Promise<BehaviorGuardStatus> {
  const { mySubject, matchId } = input;

  const [penaltiesRaw, interventionRaw, matchRaw] = await Promise.all([
    fetchPenalties().catch(() => null),
    matchId
      ? fetchInterventionFeedback(matchId).catch(() => null)
      : Promise.resolve(null),
    matchId
      ? fetchMatchDetail(matchId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const penalties = parsePenalties(penaltiesRaw, mySubject);
  const intervention = parseIntervention(
    matchId || "",
    interventionRaw,
    mySubject,
  );

  let last_match: MatchBehaviorReview | null = null;
  if (matchRaw && matchId) {
    try {
      last_match = behaviorReviewFromMatch(
        processMatchDetail(
          matchId,
          matchRaw as Record<string, unknown>,
          mySubject,
        ),
      );
    } catch {
      last_match = null;
    }
  }

  const { level, lines } = assessRisk(penalties, intervention, last_match);

  return {
    penalties,
    intervention,
    last_match,
    risk_level: level,
    risk_lines: lines,
    tips: GUARD_TIPS.slice(0, 4),
    note_reporter:
      "官方 API 不提供举报人 ID，只能看到系统判定的违规类型（interventionFeedback）。",
  };
}

export function infractionLabel(raw: string): string {
  return labelInfraction(raw);
}
