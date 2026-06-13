"use client";

import { AlertTriangle, Fish, Shield, Swords } from "lucide-react";
import {
  AGENT_ROLE_ORDER,
  AGENT_ROLE_SHORT,
  type AgentRole,
} from "@/lib/agent-roles";
import type { LiveMatchBrief } from "@/lib/live-match-brief";

function RoleBar({
  label,
  labelClass,
  counts,
  picked,
  gaps,
  summary,
}: {
  label: string;
  labelClass: string;
  counts: Record<AgentRole, number>;
  picked: number;
  gaps: string[];
  summary: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <p className={`text-[10px] font-semibold ${labelClass}`}>{label}</p>
        <p className="text-[9px] text-gray-500">
          已选 {picked}/5
          {gaps.length ? (
            <span className="ml-1 text-amber-400/90">· {gaps.join(" · ")}</span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {AGENT_ROLE_ORDER.map((role) => (
          <span
            key={role}
            className={`rounded border px-1.5 py-0.5 text-[9px] ${
              counts[role] > 0
                ? "border-white/15 bg-white/8 text-gray-200"
                : "border-white/5 bg-transparent text-gray-600"
            }`}
          >
            {AGENT_ROLE_SHORT[role]} {counts[role]}
          </span>
        ))}
      </div>
      {picked > 0 ? (
        <p className="mt-1 text-[9px] text-gray-500">{summary}</p>
      ) : (
        <p className="mt-1 text-[9px] text-gray-600">等待选人…</p>
      )}
    </div>
  );
}

export function LiveMatchBriefPanel({ brief }: { brief: LiveMatchBrief }) {
  const { allyComp, enemyComp, rankCompare, risk } = brief;
  const hasRisk =
    risk.enemySmurfCount > 0 ||
    risk.enemySusCount > 0 ||
    risk.allySmurfCount > 0;

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-white/10 bg-[#0f1419]/60 p-2.5">
      <div className="flex items-center gap-1.5">
        <Swords size={12} className="text-[#ff4655]" />
        <p className="text-[10px] font-semibold text-gray-200">对局简报</p>
        {risk.analyzed > 0 ? (
          <span className="text-[9px] text-gray-500">
            已分析 {risk.analyzed}/{risk.total} 人
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <RoleBar
          label="己方阵容"
          labelClass="text-emerald-400/90"
          counts={allyComp.counts}
          picked={allyComp.picked}
          gaps={allyComp.gaps}
          summary={allyComp.summary}
        />
        <RoleBar
          label="敌方阵容"
          labelClass="text-rose-400/90"
          counts={enemyComp.counts}
          picked={enemyComp.picked}
          gaps={enemyComp.gaps}
          summary={enemyComp.summary}
        />
      </div>

      {rankCompare ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-white/8 bg-black/15 px-2 py-1.5 text-[9px]">
          <Shield size={11} className="shrink-0 text-sky-400" />
          <span className="text-emerald-300/90">
            己方 {rankCompare.ally.avgLabel}
          </span>
          <span className="text-gray-600">vs</span>
          <span className="text-rose-300/90">
            敌方 {rankCompare.enemy.avgLabel}
          </span>
          <span className="text-gray-500">· {rankCompare.deltaLabel}</span>
        </div>
      ) : null}

      <div
        className={`rounded border px-2 py-1.5 ${
          hasRisk
            ? "border-amber-500/25 bg-amber-500/5"
            : "border-white/8 bg-black/15"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {risk.enemySmurfCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-300">
              <Fish size={10} />
              敌方炸鱼 {risk.enemySmurfCount}
            </span>
          ) : null}
          {risk.enemySusCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-300">
              <AlertTriangle size={10} />
              敌方可疑 {risk.enemySusCount}
            </span>
          ) : null}
          {!hasRisk && risk.analyzed > 0 ? (
            <span className="text-[9px] text-gray-500">风险摘要</span>
          ) : null}
        </div>
        <ul className="space-y-0.5">
          {risk.lines.map((line, i) => (
            <li key={i} className="text-[9px] leading-4 text-gray-400">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
