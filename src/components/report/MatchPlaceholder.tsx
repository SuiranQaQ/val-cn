export function MatchPlaceholder({
  matchId,
  index,
}: {
  matchId: string;
  index: number;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1a2332]/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-300">比赛 #{index + 1}</p>
          <p className="mt-1 font-mono text-[10px] text-gray-500">{matchId}</p>
        </div>
        <span className="text-[10px] text-amber-400">详情加载中/不可用</span>
      </div>
    </div>
  );
}
