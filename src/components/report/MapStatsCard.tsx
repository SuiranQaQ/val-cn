import type { MapStat } from "@/lib/stats";
import { GameIcon } from "./GameIcon";

function MapStatRow({ item }: { item: MapStat }) {
  const mapBg = item.map_splash || item.map_icon;
  const positive = item.winRate >= 50;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {mapBg ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${mapBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1725]/92 via-[#1a2332]/88 to-[#1a2332]/75" />
        </>
      ) : (
        <div className="absolute inset-0 bg-white/5" />
      )}

      <div className="relative z-10 flex items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {!mapBg ? (
            <GameIcon
              src={item.map_icon}
              alt={item.map_name}
              size={20}
              className="rounded"
            />
          ) : null}
          <span className="truncate text-[10px] font-medium text-white drop-shadow">
            {item.map_name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[9px] text-gray-300">
          <span>{item.games}场</span>
          <span className={positive ? "text-emerald-400" : "text-rose-400"}>
            {item.winRate}%胜
          </span>
          <span>ACS {Math.round(item.avgAcs)}</span>
        </div>
      </div>
    </div>
  );
}

export function MapStatsCard({
  stats,
  expanded = false,
}: {
  stats: MapStat[];
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-[#1a2332]/80 p-2 ${expanded ? "" : "h-44"}`}
    >
      <p className="mb-2 text-[10px] text-gray-500">地图胜率</p>
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
            <MapStatRow key={item.map_id || item.map_name} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
