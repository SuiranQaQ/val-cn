"use client";

import Link from "next/link";
import { ChevronDown, Loader2, Lock, RefreshCw } from "lucide-react";
import { GameIcon } from "@/components/report/GameIcon";
import {
  AGENT_ROLE_ORDER,
  AGENT_ROLE_SHORT,
  type AgentRole,
} from "@/lib/agent-roles";
import {
  ARCHETYPE_CLASS,
  ARCHETYPE_LABEL,
  classifyPlayerArchetype,
} from "@/lib/live-player-label";
import type { LiveMatchBrief } from "@/lib/live-match-brief";
import { getQueueDisplayName } from "@/lib/live-queue-label";

export interface ArenaPlayer {
  subject: string;
  name?: string;
  agent_id: string;
  agent_name: string;
  agent_selection_state?: "" | "selected" | "locked";
  agent_icon?: string;
  rank_icon?: string;
  account_level: number;
  rank_name: string;
  rank_tier?: number;
  is_me: boolean;
  is_ally: boolean;
  enrich?: {
    loaded?: boolean;
    name?: string;
    wins?: number;
    recent_games?: number;
    win_rate?: number;
    avg_acs?: number;
    avg_kda?: number;
    avg_kd?: number;
    headshot_pct?: number;
    stats_scope?: string;
    smurf_score?: number;
    rank_tier?: number;
  } | null;
}

export interface ArenaMatchData {
  phase: "pregame" | "ingame" | "none";
  map_name: string;
  mode: string;
  map_splash?: string;
  enemy_pending_count?: number;
  players: ArenaPlayer[];
}

function padRows<T>(items: T[], count = 5): (T | null)[] {
  const out: (T | null)[] = [...items];
  while (out.length < count) out.push(null);
  return out.slice(0, count);
}

function RankBadge({
  icon,
  name,
  side,
}: {
  icon?: string;
  name: string;
  side: "ally" | "enemy";
}) {
  const border =
    side === "ally" ? "border-cyan-500/15" : "border-rose-500/15";
  return (
    <div
      className={`flex w-[48px] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-white/5 bg-black/30 py-1 ${side === "ally" ? "border-l" : "border-r"}`}
    >
      <div
        className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded border ${border} bg-[#0a1018]`}
      >
        {icon ? (
          <GameIcon src={icon} alt={name} size={28} className="h-6 w-6" />
        ) : (
          <span className="text-[7px] text-gray-600">—</span>
        )}
      </div>
      <p
        className="max-w-[46px] truncate text-center text-[7px] font-medium leading-tight text-gray-300"
        title={name}
      >
        {name || "未定级"}
      </p>
    </div>
  );
}

function WinBar({
  wins,
  total,
  rate,
  side,
  alignRight,
  scope,
}: {
  wins: number;
  total: number;
  rate: number;
  side: "ally" | "enemy";
  alignRight?: boolean;
  scope?: string;
}) {
  const fill =
    side === "ally"
      ? "bg-gradient-to-r from-teal-500 to-cyan-400"
      : "bg-gradient-to-r from-rose-600 to-orange-500";

  return (
    <div className={alignRight ? "text-right" : ""}>
      <p className="text-[9px] tabular-nums text-gray-400">
        {scope ? (
          <span className="text-gray-500">{scope} · </span>
        ) : null}
        <span className="text-gray-200">{wins}胜</span>
        <span className="mx-1 text-gray-600">/</span>
        {total || 0}场
        <span className="mx-1.5 text-gray-600">·</span>
        <span className={rate >= 50 ? "text-emerald-300" : "text-rose-300"}>
          {rate}%
        </span>
      </p>
      <div className="mt-0.5 h-[4px] overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full rounded-full ${fill}`}
          style={{ width: `${Math.max(rate, total ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function CompactStats({
  enrich,
  alignRight,
}: {
  enrich: NonNullable<ArenaPlayer["enrich"]>;
  alignRight?: boolean;
}) {
  const hs = enrich.headshot_pct ? `${enrich.headshot_pct}%` : "—";
  const kd = enrich.avg_kd || "—";
  const kda = enrich.avg_kda || "—";

  return (
    <p
      className={`mt-0.5 text-[9px] tabular-nums leading-snug text-gray-400 ${alignRight ? "text-right" : ""}`}
    >
      <span className="text-gray-500">爆头</span>{" "}
      <span className="text-gray-200">{hs}</span>
      <span className="mx-1.5 text-gray-600">·</span>
      <span className="text-gray-500">KD</span>{" "}
      <span className="text-gray-200">{kd}</span>
      <span className="mx-1.5 text-gray-600">·</span>
      <span className="text-gray-500">KDA</span>{" "}
      <span className="text-gray-200">{kda}</span>
    </p>
  );
}

function PlayerRow({
  player,
  showSelection,
  side,
}: {
  player: ArenaPlayer;
  showSelection: boolean;
  side: "ally" | "enemy";
}) {
  const enrich = player.enrich;
  const name = enrich?.name || player.name || player.subject;
  const locked = player.agent_selection_state === "locked";
  const rankName =
    player.rank_name ||
    (player.rank_tier ? `Tier ${player.rank_tier}` : "未定级");
  const archetype = classifyPlayerArchetype({
    account_level: player.account_level,
    rank_tier: player.rank_tier ?? enrich?.rank_tier ?? 0,
    enrich: enrich?.loaded ? enrich : null,
  });
  const smurf = enrich?.loaded ? enrich.smurf_score ?? 0 : 0;
  const mirror = side === "enemy";
  const hasTags =
    player.is_me ||
    showSelection ||
    !!archetype ||
    smurf >= 28;

  const shell =
    side === "ally"
      ? "border-l-[3px] border-l-cyan-400/80 bg-gradient-to-r from-cyan-950/50 via-[#0d1520]/95 to-[#0a0f14]/80"
      : "border-r-[3px] border-r-rose-500/80 bg-gradient-to-l from-rose-950/50 via-[#0d1520]/95 to-[#0a0f14]/80";

  const portrait = (
    <div className="relative w-[58px] shrink-0 self-stretch overflow-hidden bg-black/40">
      {player.agent_icon ? (
        <GameIcon
          src={player.agent_icon}
          alt={player.agent_name}
          size={58}
          className="h-full min-h-[84px] w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-600">
          ?
        </div>
      )}
      {locked ? (
        <span
          className={`absolute top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-black ${mirror ? "left-1" : "right-1"}`}
        >
          <Lock size={9} strokeWidth={3} />
        </span>
      ) : null}
      <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 text-center text-[8px] text-gray-300">
        Lv.{player.account_level || "?"}
      </span>
    </div>
  );

  const info = (
    <div
      className={`flex min-w-0 flex-1 flex-col justify-center px-2 py-1.5 ${mirror ? "items-end text-right" : ""}`}
    >
      <p className="w-full whitespace-normal break-words text-[11px] font-bold leading-snug text-white">
        {name}
      </p>
      {hasTags ? (
        <div
          className={`mt-0.5 flex w-full flex-wrap items-center gap-1 ${mirror ? "justify-end" : ""}`}
        >
          {player.is_me ? (
            <span className="rounded bg-[#ff4655]/25 px-1.5 py-px text-[8px] font-bold text-[#ff9aa3]">
              我
            </span>
          ) : null}
          {showSelection ? (
            <span
              className={`rounded px-1.5 py-px text-[8px] font-semibold ${
                locked
                  ? "bg-emerald-500/25 text-emerald-300"
                  : player.agent_id
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-white/5 text-gray-500"
              }`}
            >
              {locked ? "已锁" : player.agent_id ? "已选" : "未选"}
            </span>
          ) : null}
          {archetype ? (
            <span
              className={`rounded border px-1.5 py-px text-[8px] font-semibold ${ARCHETYPE_CLASS[archetype.type]}`}
            >
              {ARCHETYPE_LABEL[archetype.type]}
            </span>
          ) : null}
          {smurf >= 28 ? (
            <span className="rounded bg-amber-500/20 px-1.5 py-px text-[8px] font-semibold text-amber-300">
              炸鱼 {smurf}
            </span>
          ) : null}
        </div>
      ) : null}

      {enrich?.loaded ? (
        <>
          <WinBar
            wins={enrich.wins ?? 0}
            total={enrich.recent_games ?? 0}
            rate={enrich.win_rate ?? 0}
            side={side}
            alignRight={mirror}
            scope={enrich.stats_scope}
          />
          <CompactStats enrich={enrich} alignRight={mirror} />
        </>
      ) : enrich === null ? null : (
        <Loader2 size={12} className="mt-2 animate-spin text-gray-600" />
      )}
    </div>
  );

  return (
    <div
      className={`flex min-h-[84px] items-stretch rounded-md border border-white/[0.06] shadow-sm ${shell} ${player.is_me ? "ring-1 ring-[#ff4655]/40" : ""}`}
    >
      {mirror ? (
        <>
          <RankBadge icon={player.rank_icon} name={rankName} side={side} />
          {info}
          {portrait}
        </>
      ) : (
        <>
          {portrait}
          {info}
          <RankBadge icon={player.rank_icon} name={rankName} side={side} />
        </>
      )}
    </div>
  );
}

function PendingRow({ index }: { index: number }) {
  return (
    <div className="flex min-h-[84px] animate-pulse items-center justify-center rounded-md border border-dashed border-rose-500/20 bg-rose-950/20">
      <p className="text-[10px] text-gray-500">
        敌方 #{index + 1} · 等待游戏 reveal
      </p>
    </div>
  );
}

function EmptyRow() {
  return <div className="min-h-[84px] rounded-md border border-transparent" />;
}

function VsCenter({ phaseLabel, compact }: { phaseLabel: string; compact?: boolean }) {
  if (compact) {
    return <div className="w-14 shrink-0" aria-hidden />;
  }

  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center self-center">
      <div
        className="flex h-12 w-12 items-center justify-center border border-white/10 bg-[#121a24]/90 shadow-lg"
        style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
      >
        <span className="text-sm font-black italic tracking-tight text-white">
          VS
        </span>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
        <span className="text-center text-[8px] leading-tight text-gray-400">
          {phaseLabel}
        </span>
      </div>
    </div>
  );
}

function BriefStrip({ brief }: { brief: LiveMatchBrief }) {
  const { allyComp, enemyComp, rankCompare, risk } = brief;
  return (
    <details className="group shrink-0 border-t border-white/[0.06] bg-black/35">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-1.5 text-[9px] text-gray-500 [&::-webkit-details-marker]:hidden">
        <span>
          简报 · 己{allyComp.picked}/5 敌{enemyComp.picked}/5
          {rankCompare
            ? ` · ${rankCompare.ally.avgLabel} vs ${rankCompare.enemy.avgLabel}`
            : ""}
          {risk.enemySmurfCount > 0 ? ` · 敌炸鱼${risk.enemySmurfCount}` : ""}
        </span>
        <ChevronDown size={12} className="group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-2 gap-2 px-3 pb-2 pt-1">
        {(["ally", "enemy"] as const).map((side) => {
          const comp = side === "ally" ? allyComp : enemyComp;
          return (
            <div key={side} className="rounded border border-white/8 px-2 py-1">
              <p
                className={`mb-1 text-[8px] font-semibold ${side === "ally" ? "text-cyan-400" : "text-rose-400"}`}
              >
                {side === "ally" ? "己方" : "敌方"}职能
              </p>
              <div className="flex flex-wrap gap-1">
                {AGENT_ROLE_ORDER.map((role: AgentRole) => (
                  <span key={role} className="text-[8px] text-gray-400">
                    {AGENT_ROLE_SHORT[role]}
                    {comp.counts[role]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function LiveMatchArena({
  data,
  brief,
  showSelection,
  phaseLabel,
  partySummary,
  enriching,
  enriched,
  onRefresh,
  autoLockHint,
}: {
  data: ArenaMatchData;
  brief: LiveMatchBrief | null;
  showSelection: boolean;
  phaseLabel: string;
  partySummary: string;
  enriching: boolean;
  enriched?: boolean;
  onRefresh?: () => void;
  autoLockHint?: string | null;
}) {
  const allies = padRows(data.players.filter((p) => p.is_ally));
  const enemies = padRows([
    ...data.players.filter((p) => !p.is_ally),
    ...Array.from(
      { length: data.enemy_pending_count ?? 0 },
      () => null as ArenaPlayer | null,
    ),
  ]);
  const queueName = getQueueDisplayName(data.mode);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#060a0f] shadow-2xl">
      <div className="relative shrink-0 border-b border-white/[0.06] px-3 py-2.5">
        {data.map_splash ? (
          <img
            src={data.map_splash}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/40 via-[#060a0f]/95 to-rose-950/40" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-bold tracking-wide text-white">
                {data.map_name || "对局认人"}
              </h2>
              <span className="text-[10px] font-semibold text-[#ff4655]">
                {phaseLabel}
              </span>
              {queueName ? (
                <span className="text-[10px] text-gray-500">{queueName}</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[9px] text-gray-500">
              {partySummary}
              {showSelection ? " · 实时选人" : ""}
              {enriching ? " · 分析中" : enriched ? " · 已分析" : ""}
              {autoLockHint ? ` · ${autoLockHint}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/live/lock"
              className="text-[9px] text-gray-500 hover:text-[#ff4655]"
            >
              锁人设置
            </Link>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={enriching}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] text-gray-200 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  size={10}
                  className={enriching ? "animate-spin" : ""}
                />
                刷新
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_50%),radial-gradient(ellipse_at_80%_50%,rgba(244,63,94,0.06),transparent_50%)]" />

        <div className="relative flex min-h-full flex-col gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`arena-row-${i}`}
              className="grid min-h-[84px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5"
            >
              {allies[i] ? (
                <PlayerRow
                  key={allies[i]!.subject}
                  player={allies[i]!}
                  showSelection={showSelection}
                  side="ally"
                />
              ) : (
                <EmptyRow key={`ally-empty-${i}`} />
              )}

              <VsCenter phaseLabel={phaseLabel} compact={i !== 2} />

              {enemies[i] ? (
                <PlayerRow
                  key={enemies[i]!.subject}
                  player={enemies[i]!}
                  showSelection={showSelection}
                  side="enemy"
                />
              ) : (
                <PendingRow key={`enemy-pending-${i}`} index={i} />
              )}
            </div>
          ))}
        </div>
      </div>

      {brief ? <BriefStrip brief={brief} /> : null}
    </div>
  );
}
