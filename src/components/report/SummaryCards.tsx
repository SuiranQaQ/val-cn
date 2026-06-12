import type { RecentSummary } from "@/lib/stats";
import { GameIcon } from "./GameIcon";

export function SummaryCards({
  summary,
  rankInfo,
  rankIcon,
  seasonName,
}: {
  summary: RecentSummary;
  rankInfo: string;
  rankIcon?: string;
  seasonName: string;
}) {
  return (
    <>
      <div className="h-16 rounded-2xl border border-white/5 bg-[#1a2332]/80 p-2 md:col-span-2">
        <p className="mb-1 text-[10px] text-gray-500">最近场次</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-semibold">
          <span className="text-emerald-400">{summary.wins}胜</span>
          <span className="text-gray-500">/</span>
          <span className="text-rose-400">{summary.losses}负</span>
          <span className="text-[10px] font-normal text-gray-400">
            共{summary.total}场 · 胜率 {summary.winRate}% · KDA {summary.avgKda}
          </span>
          <span className="text-[10px] font-normal text-gray-400">
            ACS {summary.avgAcs} · MVP {summary.mvpCount}
          </span>
        </div>
      </div>
      <div className="h-16 rounded-2xl border border-white/5 bg-[#1a2332]/80 p-2 md:col-span-2">
        <p className="mb-1 text-[10px] text-gray-500">当前段位</p>
        <div className="flex items-center gap-2">
          <GameIcon src={rankIcon} alt={rankInfo} size={28} />
          <span className="text-sm font-bold text-[#ff4655]">{rankInfo}</span>
          {seasonName ? (
            <span className="text-[10px] text-gray-400">{seasonName}</span>
          ) : null}
        </div>
      </div>
    </>
  );
}
