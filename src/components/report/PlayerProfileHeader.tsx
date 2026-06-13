import { PlayerAvatar } from "./PlayerAvatar";
import { GameIcon } from "./GameIcon";

export interface ProfileExtras {
  account_level?: number;
  rank_rr?: number;
  season_name?: string;
  player_card_wide?: string;
  penalties?: {
    has_active: boolean;
    items: Array<{ type: string; reason: string; expires_at: string }>;
    note?: string;
  };
}

export function PlayerProfileHeader({
  playerName,
  rankInfo,
  rankIcon,
  subtitle,
  cardIcon,
  cardWide,
  extras,
}: {
  playerName: string;
  rankInfo: string;
  rankIcon?: string;
  subtitle?: string;
  cardIcon?: string;
  cardWide?: string;
  extras?: ProfileExtras;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1a2332]/80 backdrop-blur-sm">
      {cardWide ? (
        <div
          className="h-20 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${cardWide})` }}
        />
      ) : null}
      <div className="flex items-start gap-3 p-3">
        <PlayerAvatar src={cardIcon} name={playerName} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-sm font-bold text-white">
              {playerName || "未知玩家"}
            </h1>
            {extras?.account_level ? (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-400">
                Lv.{extras.account_level}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <GameIcon src={rankIcon} alt={rankInfo} size={22} />
            <span className="text-xs font-semibold text-[#ff4655]">
              {rankInfo}
            </span>
            {extras?.rank_rr != null && extras.rank_rr > 0 ? (
              <span className="text-[10px] text-gray-400">{extras.rank_rr} RR</span>
            ) : null}
            {extras?.season_name ? (
              <span className="text-[10px] text-gray-400">
                {extras.season_name}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-[10px] text-gray-500">{subtitle}</p>
          ) : null}
          {extras?.penalties?.has_active ? (
            <p className="mt-1 text-[10px] text-amber-400">
              官方限制：{extras.penalties.items.map((p) => p.type).join("、")}
            </p>
          ) : null}
          {extras?.penalties?.note ? (
            <p className="mt-0.5 text-[9px] text-gray-600">
              {extras.penalties.note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
