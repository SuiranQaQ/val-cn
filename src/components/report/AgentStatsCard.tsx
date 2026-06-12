import type { AgentStat } from "@/lib/stats";
import { GameIcon } from "./GameIcon";

export function AgentStatsCard({
  stats,
  expanded = false,
}: {
  stats: AgentStat[];
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-[#1a2332]/80 p-2 ${expanded ? "" : "h-44"}`}
    >
      <p className="mb-2 text-[10px] text-gray-500">常用英雄</p>
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
              key={item.agent_id}
              className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <GameIcon
                  src={item.agent_icon}
                  alt={item.agent_name}
                  size={18}
                />
                <span className="truncate text-[10px] font-medium text-gray-200">
                  {item.agent_name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[9px] text-gray-400">
                <span>{item.games}场</span>
                <span className="text-emerald-400">{item.winRate}%胜</span>
                <span>ACS {Math.round(item.avgAcs)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
