import type { PartyRecord } from "@/lib/stats";
import { PlayerAvatar } from "./PlayerAvatar";

function PartyList({
  records,
  emptyText,
  showGamesAsMembers,
  expanded = false,
}: {
  records: PartyRecord[];
  emptyText: string;
  showGamesAsMembers?: boolean;
  expanded?: boolean;
}) {
  if (records.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-white/5 text-[10px] text-gray-500 ${expanded ? "py-6" : "h-full"}`}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className={
        expanded ? "space-y-1" : "h-full space-y-1 overflow-y-auto pr-1"
      }
    >
      {records.map((item) => (
        <div
          key={item.subject || item.name}
          className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5"
        >
              <div className="flex min-w-0 items-center gap-1.5">
                {item.card_icon ? (
                  <PlayerAvatar
                    src={item.card_icon}
                    name={item.name}
                    size={20}
                  />
                ) : null}
                <span className="truncate text-[10px] font-medium text-gray-200">
                  {item.name}
                </span>
              </div>
          <div className="flex shrink-0 items-center gap-2 text-[9px] text-gray-400">
            {showGamesAsMembers ? (
              <span>{item.games}人</span>
            ) : (
              <span>{item.games}场</span>
            )}
            <span>{item.lastPlayed}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FrequentPartyCard({
  records,
  expanded = false,
}: {
  records: PartyRecord[];
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-[#1a2332]/80 p-2 ${expanded ? "" : "h-44"}`}
    >
      <p className="mb-2 text-[10px] text-gray-500">常开黑队友（1个月）</p>
      <div className={expanded ? "" : "h-[calc(100%-1.2rem)]"}>
        <PartyList
          records={records}
          emptyText="暂无开黑记录"
          expanded={expanded}
        />
      </div>
    </div>
  );
}

export function RecentPartyCard({
  records,
  expanded = false,
}: {
  records: PartyRecord[];
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-[#1a2332]/80 p-2 ${expanded ? "" : "h-44"}`}
    >
      <p className="mb-2 text-[10px] text-gray-500">最近开黑（1周）</p>
      <div className={expanded ? "" : "h-[calc(100%-1.2rem)]"}>
        <PartyList
          records={records}
          emptyText="近一周无开黑"
          showGamesAsMembers
          expanded={expanded}
        />
      </div>
    </div>
  );
}
