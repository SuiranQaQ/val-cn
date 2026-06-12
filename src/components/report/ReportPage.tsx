"use client";

import { useEffect, useState } from "react";
import { LoadingProgress } from "./LoadingProgress";
import { ReportDashboard } from "./ReportDashboard";
import { buildRankTrend } from "@/lib/stats";

interface ReportPayload {
  mode?: string;
  query?: {
    playerName?: string;
    subject?: string;
    snapshotExpiresAt?: string;
  };
  snapshot?: {
    data?: {
      subject?: string;
      player_name?: string;
      rank_info?: string;
      season_name?: string;
      match_ids?: string[];
      match_history_total?: number;
      rank_trend?: unknown[];
      updates?: Record<string, unknown> | null;
    };
  };
}

export function ReportPage({ queryId }: { queryId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    step: 1,
    total: 3,
    label: "Initializing page",
  });
  const [playerName, setPlayerName] = useState("");
  const [subject, setSubject] = useState("");
  const [rankInfo, setRankInfo] = useState("未定级");
  const [seasonName, setSeasonName] = useState("");
  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [rankTrend, setRankTrend] = useState(
    [] as ReturnType<typeof buildRankTrend>,
  );
  const [competitiveUpdates, setCompetitiveUpdates] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setProgress({ step: 1, total: 3, label: "Verifying report access" });

      try {
        const reportRes = await fetch(
          `/api/report/${encodeURIComponent(queryId)}/data`,
        );
        const report: ReportPayload = await reportRes.json();
        if (!reportRes.ok) {
          throw new Error(
            (report as { error?: string }).error || "request_failed",
          );
        }
        if (cancelled) return;

        const snapshotData = report.snapshot?.data;
        const playerSubject =
          snapshotData?.subject || report.query?.subject || "";
        const displayName =
          snapshotData?.player_name ||
          report.query?.playerName ||
          playerSubject;

        setSubject(playerSubject);
        setPlayerName(displayName);
        setRankInfo(snapshotData?.rank_info || "未定级");
        setSeasonName(snapshotData?.season_name || "");

        const ids = (snapshotData?.match_ids || []).map(String).filter(Boolean);
        setMatchIds(ids);

        const trend =
          Array.isArray(snapshotData?.rank_trend) &&
          snapshotData.rank_trend.length
            ? (snapshotData.rank_trend as ReturnType<typeof buildRankTrend>)
            : buildRankTrend(snapshotData?.updates || null);
        setRankTrend(trend);
        setCompetitiveUpdates(snapshotData?.updates || null);

        setProgress({ step: 3, total: 3, label: "Done" });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load report");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [queryId]);

  if (loading) {
    return (
      <div className="valorant-report p-2 md:p-4">
        <div className="mx-auto max-w-5xl space-y-2">
          <LoadingProgress {...progress} />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="h-44 animate-pulse rounded-xl border border-white/5 bg-[#1a2332]/50 p-2" />
            <div className="h-44 animate-pulse rounded-xl border border-white/5 bg-[#1a2332]/50 p-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-rose-500/20 bg-[#1a2332] p-6 text-center">
          <p className="text-sm text-rose-300">加载失败</p>
          <p className="mt-2 text-xs text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ReportDashboard
      playerName={playerName}
      subject={subject}
      rankInfo={rankInfo}
      seasonName={seasonName}
      rankTrend={rankTrend}
      matchIds={matchIds}
      subtitle={`报告 ${queryId.slice(0, 8)}… · 共 ${matchIds.length} 场`}
      profile={{ season_name: seasonName }}
      competitiveUpdates={competitiveUpdates}
    />
  );
}
