"use client";

import { useEffect, useMemo, useState } from "react";
import { useMatchDetails } from "@/hooks/use-match-details";
import {
  computeBehaviorSummary,
  computeBehaviorFromUpdates,
  computeRecentSummary,
} from "@/lib/stats";

const PREVIEW_MATCHES = 10;

export function ClientHomeStats({
  displayName,
  subject,
}: {
  displayName: string;
  subject?: string;
}) {
  const [overview, setOverview] = useState<{
    subject: string;
    match_ids: string[];
    updates: Record<string, unknown> | null;
    rank_info: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/player?q=${encodeURIComponent(displayName)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.subject) {
          setOverview({
            subject: d.subject,
            match_ids: d.match_ids || [],
            updates: d.updates || null,
            rank_info: d.rank_info || "未定级",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [displayName]);

  const previewIds = useMemo(
    () => (overview?.match_ids || []).slice(0, PREVIEW_MATCHES),
    [overview?.match_ids],
  );

  const resolvedSubject = subject || overview?.subject || "";
  const { allMatches, done } = useMatchDetails(previewIds, resolvedSubject);

  const recent = useMemo(
    () => computeRecentSummary(allMatches),
    [allMatches],
  );

  const behavior = useMemo(() => {
    const fromMatches = computeBehaviorSummary(
      allMatches,
      overview?.updates || null,
    );
    const fromUpdates = computeBehaviorFromUpdates(overview?.updates || null);
    return {
      avgKda: recent.avgKda,
      afkPenalty: Math.max(
        fromMatches.afk_penalty_matches,
        fromUpdates.afk_penalty_matches,
      ),
      afkRounds: fromMatches.my_afk_rounds,
      penalizedRounds: fromMatches.my_penalized_rounds,
    };
  }, [allMatches, overview?.updates, recent.avgKda]);

  if (loading) {
    return (
      <p className="mt-4 text-xs text-[#6d7a82]">正在加载最近战绩…</p>
    );
  }

  if (!overview) return null;

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6d7a82]">
        最近 {PREVIEW_MATCHES} 场 · {overview.rank_info}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-sm border border-white/10 bg-[#0f1923]/80 px-3 py-2.5">
          <p className="text-lg font-bold text-white">
            {done && allMatches.length > 0 ? behavior.avgKda : "—"}
          </p>
          <p className="text-[10px] text-[#8b979f]">场均 K/D/A</p>
        </div>
        <div className="rounded-sm border border-white/10 bg-[#0f1923]/80 px-3 py-2.5">
          <p className="text-lg font-bold text-white">{behavior.afkRounds}</p>
          <p className="text-[10px] text-[#8b979f]">AFK 回合</p>
        </div>
        <div className="rounded-sm border border-white/10 bg-[#0f1923]/80 px-3 py-2.5">
          <p className="text-lg font-bold text-white">
            {behavior.penalizedRounds}
          </p>
          <p className="text-[10px] text-[#8b979f]">局内处罚回合</p>
        </div>
        <div className="rounded-sm border border-white/10 bg-[#0f1923]/80 px-3 py-2.5">
          <p className="text-lg font-bold text-white">{behavior.afkPenalty}</p>
          <p className="text-[10px] text-[#8b979f]">竞技 AFK 罚分场</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#5f6c74]">
        「局内处罚回合」是比赛内的行为标记，不等于封号；下方完整报告可查看详情。
      </p>
    </div>
  );
}
