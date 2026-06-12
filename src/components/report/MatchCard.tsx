"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProcessedMatch } from "@/lib/match-processor";
import { GameIcon } from "./GameIcon";
import { PlayerAvatar } from "./PlayerAvatar";
import { MatchRoundTimeline } from "./MatchRoundTimeline";

function MvpBadge() {
  return (
    <span className="shrink-0 rounded bg-amber-500/20 px-1 text-[8px] font-bold text-amber-300">
      MVP
    </span>
  );
}

function PlayerRow({
  player,
  highlight,
}: {
  player: ProcessedMatch["teammates"][number];
  highlight?: boolean;
}) {
  const tag = player.tagLine.trim();
  const name =
    player.gameName !== "未知"
      ? player.gameName
      : tag
        ? ""
        : player.subject.slice(0, 8);

  return (
    <div
      className={`grid grid-cols-12 items-center gap-1 rounded px-1 py-1 text-[10px] ${
        highlight ? "bg-white/5" : ""
      }`}
    >
      <div className="col-span-4 flex min-w-0 items-center gap-1 truncate">
        <PlayerAvatar
          src={player.player_card_icon}
          name={name || player.gameName}
          size={18}
        />
        <GameIcon src={player.agent_icon} alt={player.agent_name} size={16} />
        <span className="truncate font-medium text-gray-200">
          {name}
          {tag ? <span className="text-gray-500">#{tag}</span> : null}
        </span>
        {player.is_me ? (
          <span className="shrink-0 rounded bg-[#ff4655] px-1 text-[8px] font-bold text-white">
            YOU
          </span>
        ) : null}
        {player.is_mvp ? <MvpBadge /> : null}
      </div>
      <div className="col-span-2 text-center font-mono text-gray-300">
        {player.stats.kills}/{player.stats.deaths}/{player.stats.assists}
      </div>
      <div className="col-span-2 text-center font-mono text-gray-300">
        {player.acs}
      </div>
      <div className="col-span-2 text-center font-mono text-gray-300">
        {player.hs_rate}
      </div>
      <div className="col-span-2 flex items-center justify-center gap-1 truncate text-gray-400">
        <GameIcon src={player.rank_icon} alt={player.rank_name} size={14} />
        <span className="truncate">{player.rank_name}</span>
      </div>
    </div>
  );
}

export function MatchCard({
  match,
  forceExpanded = false,
}: {
  match: ProcessedMatch;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = forceExpanded || expanded;
  const mapBg = match.map_splash || match.map_icon;

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a2332]/80">
      <button
        type="button"
        onClick={() => {
          if (!forceExpanded) setExpanded((v) => !v);
        }}
        className="relative flex w-full items-stretch justify-between gap-2 text-left transition hover:brightness-110"
      >
        {mapBg ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${mapBg})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1725]/92 via-[#1a2332]/88 to-[#1a2332]/75" />
          </>
        ) : null}

        <div className="relative z-10 min-w-0 flex-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold ${
                match.is_win ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {match.is_win ? "胜利" : "失败"}
            </span>
            {match.is_mvp ? <MvpBadge /> : null}
            <span className="text-xs font-semibold text-white drop-shadow">
              {match.map_name}
            </span>
            <span className="text-[10px] text-gray-300">{match.queue_name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-300">
            <span>{match.game_start}</span>
            <span>比分 {match.score}</span>
            <span>KDA {match.kda}</span>
            <span>ACS {match.acs}</span>
            <span>HS {match.hs_rate}</span>
            <span className="inline-flex items-center gap-1">
              <GameIcon
                src={match.agent_icon}
                alt={match.agent_name}
                size={14}
              />
              {match.agent_name}
            </span>
            {match.rank_name && match.rank_name !== "-" ? (
              <span className="inline-flex items-center gap-1">
                <GameIcon
                  src={match.rank_icon}
                  alt={match.rank_name}
                  size={14}
                />
                {match.rank_name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 items-center self-center p-3 text-gray-300">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 bg-[#1a2332]/95 p-2">
          {!forceExpanded ? (
            <MatchRoundTimeline rounds={match.round_timeline || []} />
          ) : null}
          <div className="mb-1 grid grid-cols-12 gap-1 px-1 text-[8px] uppercase tracking-wider text-gray-500">
            <div className="col-span-4">玩家</div>
            <div className="col-span-2 text-center">KDA</div>
            <div className="col-span-2 text-center">ACS</div>
            <div className="col-span-2 text-center">HS%</div>
            <div className="col-span-2 text-center">段位</div>
          </div>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-gray-500">
            己方
          </p>
          {match.teammates.map((player) => (
            <PlayerRow
              key={player.subject}
              player={player}
              highlight={player.is_me}
            />
          ))}
          <p className="mb-1 mt-2 text-[9px] uppercase tracking-wider text-gray-500">
            敌方
          </p>
          {match.enemies.map((player) => (
            <PlayerRow key={player.subject} player={player} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
