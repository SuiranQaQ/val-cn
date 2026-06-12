"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LoadingProgress } from "@/components/report/LoadingProgress";
import { ReportDashboard } from "@/components/report/ReportDashboard";

interface StoredReport {
  subject: string;
  player_name: string;
  rank_info: string;
  rank_rr?: number;
  season_name?: string;
  account_level?: number;
  player_card_icon?: string;
  player_card_wide?: string;
  penalties?: {
    has_active: boolean;
    items: Array<{ type: string; reason: string; expires_at: string }>;
    note?: string;
  };
  match_ids: string[];
  match_history_total: number;
  rank_trend: Array<{
    label: string;
    tier: number;
    rr: number;
    changed: number;
  }>;
  updates?: Record<string, unknown> | null;
}

export default function LocalReportPage() {
  const params = useParams<{ queryId: string }>();
  const searchParams = useSearchParams();
  const queryId = params.queryId;
  const [stored, setStored] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`player_report_${queryId}`);
    if (!raw) {
      setError("本地报告数据不存在，请重新查询");
      setLoading(false);
      return;
    }

    try {
      setStored(JSON.parse(raw) as StoredReport);
    } catch {
      setError("本地报告数据损坏，请重新查询");
    } finally {
      setLoading(false);
    }
  }, [queryId]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-5xl">
          <LoadingProgress step={2} total={3} label="Loading report" />
        </div>
      </div>
    );
  }

  if (error || !stored) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 text-sm text-rose-300">
        {error || "数据不存在"}
      </div>
    );
  }

  return (
    <ReportDashboard
      playerName={searchParams.get("q") || stored.player_name}
      subject={stored.subject}
      rankInfo={stored.rank_info}
      seasonName={stored.season_name || ""}
      rankTrend={stored.rank_trend || []}
      matchIds={stored.match_ids || []}
      subtitle={`本地查询 · 历史共 ${stored.match_history_total || stored.match_ids.length} 场`}
      profile={{
        rank_rr: stored.rank_rr,
        season_name: stored.season_name,
        account_level: stored.account_level,
        player_card_icon: stored.player_card_icon,
        player_card_wide: stored.player_card_wide,
        penalties: stored.penalties,
      }}
      competitiveUpdates={stored.updates || null}
    />
  );
}
