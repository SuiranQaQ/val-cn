"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LoadingProgress } from "@/components/report/LoadingProgress";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import {
  buildStoredPlayerReport,
  saveStoredPlayerReport,
  type StoredPlayerReport,
} from "@/lib/player-report-storage";
import { normalizeNameTag } from "@/lib/name-resolve";

export default function LocalReportPage() {
  const params = useParams<{ queryId: string }>();
  const searchParams = useSearchParams();
  const queryId = params.queryId;
  const [stored, setStored] = useState<StoredPlayerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const raw = sessionStorage.getItem(`player_report_${queryId}`);
      if (raw) {
        try {
          if (!cancelled) setStored(JSON.parse(raw) as StoredPlayerReport);
        } catch {
          if (!cancelled) setError("本地报告数据损坏，请重新查询");
        }
        if (!cancelled) setLoading(false);
        return;
      }

      const q = normalizeNameTag(searchParams.get("q") || "");
      if (!q || !q.includes("#")) {
        if (!cancelled) {
          setError("分享链接已失效，请从首页重新查询");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/player?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(String(data.error || "查询失败"));
        }
        const report = buildStoredPlayerReport(data, q);
        saveStoredPlayerReport(queryId, report);
        if (!cancelled) setStored(report);
      } catch {
        if (!cancelled) {
          setError("无法加载分享报告，请从首页重新查询");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [queryId, searchParams]);

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
