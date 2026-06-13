import type { BehaviorSummary } from "@/lib/stats";

export function BehaviorSummaryCard({ summary }: { summary: BehaviorSummary }) {
  const items = [
    {
      label: "竞技罚分场次",
      value: summary.afk_penalty_matches,
      hint: "你因 AFK/行为被扣 RR 的场次",
    },
    {
      label: "局内处罚回合",
      value: summary.my_penalized_rounds,
      hint: "比赛内 wasPenalized 行为标记，不等于封号",
    },
    {
      label: "你的 AFK 回合",
      value: summary.my_afk_rounds,
    },
    {
      label: "可疑队友场次",
      value: summary.flagged_teammate_matches,
      hint: "队友有局内异常行为标记",
    },
  ];

  return (
    <div className="h-44 rounded-xl border border-white/5 bg-[#1a2332]/80 p-2">
      <p className="mb-2 text-[10px] text-gray-500">行为摘要</p>
      <div className="grid h-[calc(100%-1.2rem)] grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col justify-center rounded-lg bg-white/5 px-2 py-1.5"
            title={item.hint}
          >
            <span className="text-lg font-bold text-white">{item.value}</span>
            <span className="text-[9px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
