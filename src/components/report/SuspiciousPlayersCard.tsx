import type { SuspiciousTeammate } from "@/lib/stats";
import { PlayerAvatar } from "./PlayerAvatar";

export function SuspiciousPlayersCard({
  players,
  expanded = false,
}: {
  players: SuspiciousTeammate[];
  expanded?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-500/10 bg-[#1a2332]/80 p-2">
      <p className="mb-1 text-[10px] text-amber-400/90">可疑队友分析</p>
      <p className="mb-2 text-[8px] leading-relaxed text-gray-600">
        官方 API
        无法查询他人封禁/处罚记录，仅能从比赛内行为（局内处罚标记、AFK、与你同场时你吃到竞技罚分等）推断可疑对象，供挂车溯源参考，不能作为封号依据。
      </p>
      {players.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg bg-white/5 text-[10px] text-gray-500">
          暂未发现明显异常队友
        </div>
      ) : (
        <div
          className={
            expanded ? "space-y-1" : "max-h-48 space-y-1 overflow-y-auto pr-1"
          }
        >
          {players.map((item) => (
            <div
              key={item.subject || item.name}
              className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <PlayerAvatar
                    src={item.card_icon}
                    name={item.name}
                    size={22}
                  />
                  <span className="truncate text-[10px] font-medium text-gray-200">
                    {item.name}
                  </span>
                </div>
                <span className="shrink-0 text-[9px] text-amber-400">
                  风险 {item.risk_score}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {item.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-black/20 px-1 py-0.5 text-[8px] text-gray-400"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <p className="mt-0.5 text-[8px] text-gray-600">
                同场 {item.games} 次
                {item.co_penalty_games > 0
                  ? ` · 你受罚同场 ${item.co_penalty_games} 次`
                  : ""}
                {" · "}
                {item.last_seen}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
