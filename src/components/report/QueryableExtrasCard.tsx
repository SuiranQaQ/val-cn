const QUERYABLE_ITEMS = [
  {
    title: "封禁 / 匹配处罚",
    api: "GET /restrictions/v3/penalties",
    note: "限当前登录会话账号；查他人时显示会话方状态",
  },
  {
    title: "账号等级 XP",
    api: "GET /account-xp/v1/players/{puuid}",
    note: "通常需本人会话",
  },
  {
    title: "当前名片配装",
    api: "GET /personalization/v2/players/{puuid}/playerloadout",
    note: "他人可从比赛详情 playerCard 字段获取",
  },
  {
    title: "竞技 MMR / 赛季",
    api: "GET /mmr/v1/players/{puuid}/competitiveupdates",
    note: "含 SeasonID、RR 变动",
  },
  {
    title: "比赛内行为数据",
    api: "match-details players.behaviorFactors",
    note: "AFK 回合、友伤等（详情内已有）",
  },
  {
    title: "回避名单",
    api: "GET /restrictions/v1/avoidList",
    note: "仅本人",
  },
];

export function QueryableExtrasCard() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1a2332]/80 p-2">
      <p className="mb-2 text-[10px] text-gray-500">官方 API 还可查询</p>
      <div className="space-y-1.5">
        {QUERYABLE_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-lg bg-white/5 px-2 py-1.5"
          >
            <p className="text-[10px] font-medium text-gray-200">{item.title}</p>
            <p className="font-mono text-[8px] text-gray-500">{item.api}</p>
            <p className="text-[8px] text-gray-600">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
