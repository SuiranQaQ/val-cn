import type { RoundTimelineEntry } from "@/lib/match-behavior";

export function MatchRoundTimeline({ rounds }: { rounds: RoundTimelineEntry[] }) {
  if (!rounds.length) return null;

  return (
    <div className="mb-2">
      <p className="mb-1 text-[9px] uppercase tracking-wider text-gray-500">
        回合时间线
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {rounds.map((r) => {
          return (
            <div
              key={r.round}
              className="flex min-w-[52px] shrink-0 flex-col items-center rounded-md border border-white/10 bg-black/20 px-1.5 py-1"
              title={`${r.result} · ${r.winning_team} 胜`}
            >
              <span className="text-[8px] text-gray-500">R{r.round + 1}</span>
              <span
                className={`text-[9px] font-bold ${
                  r.my_kills > 0 ? "text-emerald-400" : "text-gray-600"
                }`}
              >
                {r.my_kills}K
              </span>
              {r.my_deaths > 0 ? (
                <span className="text-[8px] text-rose-400">{r.my_deaths}D</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
