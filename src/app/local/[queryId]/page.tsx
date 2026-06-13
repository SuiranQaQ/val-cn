"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { isClientApp } from "@/lib/app-mode";
import { LoadingProgress } from "@/components/report/LoadingProgress";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import {
  buildStoredPlayerReport,
  saveStoredPlayerReport,
  type StoredPlayerReport,
} from "@/lib/player-report-storage";
import { normalizeNameTag } from "@/lib/name-tag";

function LocalReportPageInner() {
  const params = useParams<{ queryId: string }>();
  const router = useRouter();
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

  const playerName = searchParams.get("q") || stored?.player_name || "";

  const body = loading ? (
    <div className="py-4">
      <LoadingProgress step={2} total={3} label="Loading report" />
    </div>
  ) : error || !stored ? (
    <div className="flex min-h-[40vh] items-center justify-center py-8 text-sm text-rose-300">
      {error || "数据不存在"}
    </div>
  ) : (
    <ReportDashboard
      playerName={playerName}
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

  if (isClientApp()) {
    return (
      <ClientShell scrollable>
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-white/15 px-3 py-1.5 text-xs text-[#c5cdd3] transition hover:border-white/30 hover:text-white"
          >
            ← 返回
          </button>
          <Link
            href="/"
            className="text-xs text-[#6d7a82] hover:text-white"
          >
            我的
          </Link>
          {playerName ? (
            <span className="truncate text-xs text-[#8b979f]">{playerName}</span>
          ) : null}
        </div>
        {body}
      </ClientShell>
    );
  }

  return <div className="min-h-screen overflow-y-auto">{body}</div>;
}

export default function LocalReportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <LoadingProgress step={1} total={3} label="Loading report" />
        </div>
      }
    >
      <LocalReportPageInner />
    </Suspense>
  );
}
