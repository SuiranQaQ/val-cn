import type { TeammateStat } from "@/lib/stats";
import { PlayerAvatar } from "./PlayerAvatar";

export function TeammateStatsCard({
  stats,
  expanded = false,
}: {
  stats: TeammateStat[];
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-[#1a2332]/80 p-2 ${expanded ? "" : "h-44"}`}
    >
      <p className="mb-2 text-[10px] text-gray-500">近期队友统计</p>
      {stats.length === 0 ? (
        <div
          className={`flex items-center justify-center rounded-lg bg-white/5 text-[10px] text-gray-500 ${expanded ? "py-6" : "h-[calc(100%-1.2rem)]"}`}
        >
          暂无数据
        </div>
      ) : (
        <div
          className={
            expanded
              ? "space-y-1"
              : "h-[calc(100%-1.2rem)] space-y-1 overflow-y-auto pr-1"
          }
        >
          {stats.map((item) => (
            <div
              key={item.subject || item.name}
              className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <PlayerAvatar
                  src={item.card_icon}
                  name={item.name}
                  size={20}
                />
                <span className="truncate text-[10px] font-medium text-gray-200">
                  {item.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[9px] text-gray-400">
                <span>{item.games}场</span>
                <span className="text-emerald-400">{item.winRate}%胜</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
