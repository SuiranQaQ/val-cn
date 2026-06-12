"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMatchDetails } from "@/hooks/use-match-details";
import { TeammateStatsCard } from "./TeammateStatsCard";
import { AgentStatsCard } from "./AgentStatsCard";
import { FrequentPartyCard, RecentPartyCard } from "./PartyRecordsCard";
import { RankTrendChart } from "./RankTrendChart";
import { SummaryCards } from "./SummaryCards";
import { MatchCard } from "./MatchCard";
import { MatchPlaceholder } from "./MatchPlaceholder";
import { QueueFilter } from "./QueueFilter";
import {
  PlayerProfileHeader,
  type ProfileExtras,
} from "./PlayerProfileHeader";
import { MapStatsCard } from "./MapStatsCard";
import { BehaviorSummaryCard } from "./BehaviorSummaryCard";
import { SuspiciousPlayersCard } from "./SuspiciousPlayersCard";
import { ReportShareBar } from "./ReportShareBar";
import {
  computeAgentStats,
  computeBehaviorSummary,
  computeFrequentPartyMates,
  computeMapStats,
  computeRecentPartySessions,
  computeRecentSummary,
  computeSuspiciousTeammates,
  computeTeammateStats,
  filterMatchesByQueue,
  QUEUE_FILTER_OPTIONS,
  type QueueFilterId,
  type RankTrendPoint,
} from "@/lib/stats";

const PAGE_SIZE = 10;
const CAPTURE_MATCH_LIMIT = 10;

export function ReportDashboard({
  playerName,
  subject,
  rankInfo,
  seasonName = "",
  rankTrend: rankTrendProp,
  matchIds,
  subtitle,
  profile,
  competitiveUpdates,
}: {
  playerName: string;
  subject: string;
  rankInfo: string;
  seasonName?: string;
  rankTrend?: RankTrendPoint[];
  matchIds: string[];
  subtitle?: string;
  profile?: ProfileExtras & {
    player_card_icon?: string;
    player_card_wide?: string;
  };
  competitiveUpdates?: Record<string, unknown> | null;
}) {
  const [queueFilter, setQueueFilter] = useState<QueueFilterId>("all");
  const [page, setPage] = useState(1);
  const [capturing, setCapturing] = useState(false);
  const reportCaptureRef = useRef<HTMLDivElement>(null);

  const {
    allMatches,
    errors,
    loading,
    loadedCount,
    totalCount,
    done,
  } = useMatchDetails(matchIds, subject);

  const filteredMatches = useMemo(
    () => filterMatchesByQueue(allMatches, queueFilter),
    [allMatches, queueFilter],
  );

  const queueCounts = useMemo(() => {
    const counts: Partial<Record<QueueFilterId, number>> = { all: allMatches.length };
    for (const m of allMatches) {
      const q = m.queue_id as QueueFilterId;
      if (QUEUE_FILTER_OPTIONS.some((o) => o.id === q)) {
        counts[q] = (counts[q] || 0) + 1;
      }
    }
    return counts;
  }, [allMatches]);

  const teammateStats = useMemo(
    () => computeTeammateStats(filteredMatches, subject),
    [filteredMatches, subject],
  );
  const agentStats = useMemo(
    () => computeAgentStats(filteredMatches, subject),
    [filteredMatches, subject],
  );
  const frequentParty = useMemo(
    () => computeFrequentPartyMates(filteredMatches, subject, 30),
    [filteredMatches, subject],
  );
  const recentParty = useMemo(
    () => computeRecentPartySessions(filteredMatches, subject, 7),
    [filteredMatches, subject],
  );
  const recentSummary = useMemo(
    () => computeRecentSummary(filteredMatches),
    [filteredMatches],
  );
  const rankIcon = useMemo(
    () => filteredMatches.find((m) => m.rank_icon)?.rank_icon,
    [filteredMatches],
  );
  const mapStats = useMemo(
    () => computeMapStats(filteredMatches),
    [filteredMatches],
  );
  const behaviorSummary = useMemo(
    () => computeBehaviorSummary(filteredMatches, competitiveUpdates || null),
    [filteredMatches, competitiveUpdates],
  );
  const suspiciousPlayers = useMemo(
    () =>
      computeSuspiciousTeammates(
        filteredMatches,
        subject,
        competitiveUpdates || null,
      ),
    [filteredMatches, subject, competitiveUpdates],
  );

  const resolvedProfile = useMemo(() => {
    const me = allMatches
      .flatMap((m) => m.teammates)
      .find((p) => p.is_me && p.player_card_icon);
    const loadSubtitle = [
      subtitle || `共 ${matchIds.length} 场比赛`,
      done
        ? `已加载 ${allMatches.length} 场详情`
        : loading
          ? `加载中 ${loadedCount}/${totalCount}`
          : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      cardIcon: profile?.player_card_icon || me?.player_card_icon,
      cardWide: profile?.player_card_wide,
      seasonName: seasonName || profile?.season_name,
      extras: {
        account_level:
          profile?.account_level || me?.account_level || undefined,
        rank_rr: profile?.rank_rr,
        season_name: seasonName || profile?.season_name,
        penalties: profile?.penalties,
      } satisfies ProfileExtras,
      loadSubtitle,
    };
  }, [
    allMatches,
    profile,
    seasonName,
    subtitle,
    matchIds.length,
    done,
    loading,
    loadedCount,
    totalCount,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const displayMatches = capturing
    ? filteredMatches.slice(0, CAPTURE_MATCH_LIMIT)
    : filteredMatches.slice(pageStart, pageStart + PAGE_SIZE);

  const pendingIds = useMemo(() => {
    if (capturing) return [];
    const source =
      queueFilter === "all"
        ? matchIds
        : filteredMatches.map((m) => m.match_id);
    return source
      .slice(pageStart, pageStart + PAGE_SIZE)
      .filter((id) => !allMatches.some((m) => m.match_id === id));
  }, [
    capturing,
    matchIds,
    filteredMatches,
    queueFilter,
    pageStart,
    allMatches,
  ]);

  const prepareCapture = useCallback(async () => {
    setCapturing(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 80));
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }, []);

  const finishCapture = useCallback(() => {
    setCapturing(false);
  }, []);

  return (
    <div className="valorant-report bg-[#07111d] p-2 md:p-4">
      <div className="mx-auto max-w-5xl space-y-2">
        <ReportShareBar
          playerName={playerName}
          subject={subject}
          captureRef={reportCaptureRef}
          onPrepareCapture={prepareCapture}
          onFinishCapture={finishCapture}
        />

        <div
          ref={reportCaptureRef}
          data-capturing={capturing ? "true" : undefined}
          className="space-y-2"
        >
          <PlayerProfileHeader
            playerName={playerName}
            rankInfo={rankInfo}
            rankIcon={rankIcon}
            subtitle={resolvedProfile.loadSubtitle}
            cardIcon={resolvedProfile.cardIcon}
            cardWide={resolvedProfile.cardWide}
            extras={resolvedProfile.extras}
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <MapStatsCard stats={mapStats} expanded={capturing} />
            <BehaviorSummaryCard summary={behaviorSummary} />
          </div>

          <SuspiciousPlayersCard
            players={suspiciousPlayers}
            expanded={capturing}
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <TeammateStatsCard stats={teammateStats} expanded={capturing} />
            <AgentStatsCard stats={agentStats} expanded={capturing} />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <FrequentPartyCard records={frequentParty} expanded={capturing} />
            <RecentPartyCard records={recentParty} expanded={capturing} />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <RankTrendChart
              data={rankTrendProp || []}
              capturing={capturing}
            />
            <SummaryCards
              summary={recentSummary}
              rankInfo={rankInfo}
              rankIcon={rankIcon}
              seasonName={resolvedProfile.seasonName || seasonName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500">
                {capturing ? "最近10场（展开详情）" : "比赛列表"}
              </p>
              {!capturing ? (
                <QueueFilter
                  value={queueFilter}
                  onChange={(id) => {
                    setQueueFilter(id);
                    setPage(1);
                  }}
                  counts={queueCounts}
                />
              ) : null}
            </div>

            {!capturing && totalPages > 1 ? (
              <div
                className="flex items-center justify-end gap-2"
                data-capture-exclude="true"
              >
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-300 disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-[10px] text-gray-500">
                  {safePage} / {totalPages}
                  {queueFilter !== "all"
                    ? ` · ${filteredMatches.length} 场`
                    : ""}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-300 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            ) : null}

            {displayMatches.length === 0 && (loading || pendingIds.length > 0)
              ? pendingIds.map((id, index) => (
                  <MatchPlaceholder
                    key={id}
                    matchId={id}
                    index={pageStart + index}
                  />
                ))
              : null}

            {displayMatches.map((match) => (
              <MatchCard
                key={match.match_id}
                match={match}
                forceExpanded={capturing}
              />
            ))}

            {done && filteredMatches.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#1a2332]/80 p-6 text-center text-xs text-gray-500">
                {queueFilter === "all" ? "暂无比赛记录" : "该模式下暂无比赛"}
              </div>
            ) : null}

            {Object.keys(errors).length > 0 &&
            allMatches.length === 0 &&
            done ? (
              <p className="text-center text-[10px] text-amber-400/80">
                比赛详情暂时无法加载，请确认本机可访问国服 Riot API，或稍后重试
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
