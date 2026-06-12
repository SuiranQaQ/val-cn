"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Users, AlertTriangle, Fish } from "lucide-react";

interface PlayerEnrich {
  name: string;
  recent_games: number;
  win_rate: number;
  avg_acs: number;
  avg_kda: number;
  smurf_score: number;
  smurf_flags: string[];
  suspicious_score: number;
  suspicious_flags: string[];
  loaded: boolean;
  cached?: boolean;
}

interface LivePlayerRow {
  subject: string;
  name?: string;
  team_id: string;
  party_id: string;
  party_size: number;
  party_index: number;
  agent_id: string;
  agent_name: string;
  account_level: number;
  rank_tier: number;
  rank_name: string;
  is_me: boolean;
  is_ally: boolean;
  enrich?: PlayerEnrich | null;
}

interface LivePartyGroup {
  party_id: string;
  party_index: number;
  size: number;
  subjects: string[];
  team_id: string;
  is_ally: boolean;
}

interface LiveMatchData {
  active: boolean;
  phase: "pregame" | "ingame" | "none";
  match_id: string;
  map_name: string;
  mode: string;
  state: string;
  parties: LivePartyGroup[];
  players: LivePlayerRow[];
  enriched?: boolean;
  hint?: string;
  error?: string;
}

const PHASE_LABEL: Record<string, string> = {
  pregame: "选人阶段",
  ingame: "对局进行中",
  none: "未在匹配中",
};

/** 不同 PartyID 用不同颜色区分 */
const PARTY_PALETTE = [
  {
    row: "border-violet-500/35 bg-violet-500/[0.07]",
    chip: "border-violet-500/30 bg-violet-500/15 text-violet-200",
    label: "组队 A",
  },
  {
    row: "border-amber-500/35 bg-amber-500/[0.07]",
    chip: "border-amber-500/30 bg-amber-500/15 text-amber-200",
    label: "组队 B",
  },
  {
    row: "border-cyan-500/35 bg-cyan-500/[0.07]",
    chip: "border-cyan-500/30 bg-cyan-500/15 text-cyan-200",
    label: "组队 C",
  },
  {
    row: "border-pink-500/35 bg-pink-500/[0.07]",
    chip: "border-pink-500/30 bg-pink-500/15 text-pink-200",
    label: "组队 D",
  },
  {
    row: "border-lime-500/35 bg-lime-500/[0.07]",
    chip: "border-lime-500/30 bg-lime-500/15 text-lime-200",
    label: "组队 E",
  },
];

function partyPalette(index: number) {
  if (index <= 0) return null;
  return PARTY_PALETTE[(index - 1) % PARTY_PALETTE.length];
}

function partyLetter(index: number): string {
  return String.fromCharCode(64 + index);
}

function riskTone(score: number): string {
  if (score >= 50) return "text-rose-300 bg-rose-500/15 border-rose-500/30";
  if (score >= 28) return "text-amber-300 bg-amber-500/15 border-amber-500/30";
  return "text-gray-400 bg-white/5 border-white/10";
}

function PlayerRow({
  player,
  partyRowClass,
}: {
  player: LivePlayerRow;
  partyRowClass?: string;
}) {
  const name =
    player.enrich?.name || player.name || `${player.subject.slice(0, 8)}…`;
  const enrich = player.enrich;
  const smurf = enrich?.smurf_score ?? 0;
  const sus = enrich?.suspicious_score ?? 0;
  const palette = partyPalette(player.party_index);
  const partyLabel =
    player.party_size >= 2 && player.party_index > 0
      ? `${partyLetter(player.party_index)}组 · ${player.party_size}黑`
      : null;

  const baseClass = player.is_me
    ? "border-[#ff4655]/40 bg-[#ff4655]/10"
    : player.is_ally
      ? partyRowClass || "border-emerald-500/20 bg-emerald-500/5"
      : partyRowClass || "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-lg border px-2 py-1.5 ${baseClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">
            {name}
            {player.is_me ? (
              <span className="ml-1 text-[9px] text-[#ff4655]">我</span>
            ) : null}
          </p>
          <p className="text-[9px] text-gray-500">
            {player.agent_name} · Lv.{player.account_level || "?"} ·{" "}
            {player.rank_name}
            {partyLabel ? (
              <span
                className={`ml-1 ${palette?.chip.split(" ").find((c) => c.startsWith("text-")) || "text-sky-400"}`}
              >
                · {partyLabel}
              </span>
            ) : (
              <span className="ml-1 text-gray-600">· 单排</span>
            )}
          </p>
        </div>
        {enrich?.loaded ? (
          <div className="text-right text-[9px] text-gray-400">
            <p>
              近{enrich.recent_games}场 {enrich.win_rate}%胜
            </p>
            <p>
              ACS {enrich.avg_acs || "—"} · KDA {enrich.avg_kda || "—"}
            </p>
          </div>
        ) : enrich === null ? null : (
          <Loader2 size={12} className="animate-spin text-gray-500" />
        )}
      </div>
      {(smurf >= 28 || sus >= 12) && enrich?.loaded ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {smurf >= 28 ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[8px] ${riskTone(smurf)}`}
            >
              <Fish size={9} />
              炸鱼 {smurf}
              {enrich.smurf_flags[0] ? ` · ${enrich.smurf_flags[0]}` : ""}
            </span>
          ) : null}
          {sus >= 12 ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[8px] ${riskTone(sus)}`}
            >
              <AlertTriangle size={9} />
              可疑 {sus}
              {enrich.suspicious_flags[0]
                ? ` · ${enrich.suspicious_flags[0]}`
                : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function groupSidePlayers(players: LivePlayerRow[]) {
  const byParty = new Map<number, LivePlayerRow[]>();
  const solos: LivePlayerRow[] = [];

  for (const p of players) {
    if (p.party_index > 0 && p.party_size >= 2) {
      const list = byParty.get(p.party_index) || [];
      list.push(p);
      byParty.set(p.party_index, list);
    } else {
      solos.push(p);
    }
  }

  const groups = [...byParty.entries()].sort((a, b) => a[0] - b[0]);
  return { groups, solos };
}

function SideColumn({
  title,
  titleClass,
  players,
}: {
  title: string;
  titleClass: string;
  players: LivePlayerRow[];
}) {
  const { groups, solos } = groupSidePlayers(players);

  return (
    <div>
      <p className={`mb-1.5 text-[9px] uppercase tracking-wider ${titleClass}`}>
        {title} ({players.length})
      </p>
      <div className="space-y-2">
        {groups.map(([partyIndex, members]) => {
          const palette = partyPalette(partyIndex);
          return (
            <div key={partyIndex} className="space-y-1">
              <p
                className={`text-[8px] font-medium uppercase tracking-wider ${palette?.chip.split(" ").find((c) => c.startsWith("text-")) || "text-gray-500"}`}
              >
                {partyLetter(partyIndex)} 组 · {members[0]?.party_size} 人组队
              </p>
              {members.map((p) => (
                <PlayerRow
                  key={p.subject}
                  player={p}
                  partyRowClass={palette?.row}
                />
              ))}
            </div>
          );
        })}
        {solos.length > 0 ? (
          <div className="space-y-1">
            {groups.length > 0 ? (
              <p className="text-[8px] uppercase tracking-wider text-gray-600">
                单排 ({solos.length})
              </p>
            ) : null}
            {solos.map((p) => (
              <PlayerRow key={p.subject} player={p} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildPartySummary(parties: LivePartyGroup[]): string {
  if (!parties.length) return "全场单排";

  const ally = parties.filter((p) => p.is_ally);
  const enemy = parties.filter((p) => !p.is_ally);

  const fmt = (list: LivePartyGroup[]) =>
    list.length
      ? list.map((g) => `${partyLetter(g.party_index)}组${g.size}黑`).join("+")
      : "全单排";

  return `己方 ${fmt(ally)} · 敌方 ${fmt(enemy)}`;
}

export function LiveMatchPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const matchIdRef = useRef("");

  const fetchMatch = useCallback(async (withEnrich: boolean) => {
    if (withEnrich) setEnriching(true);
    try {
      const res = await fetch(
        `/api/live-match?enrich=${withEnrich ? "true" : "false"}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as LiveMatchData & { hint?: string };
      if (!res.ok && res.status === 503) {
        setError(json.hint || "需要本机开启瓦罗兰特客户端");
        setData(null);
        return;
      }
      setError(json.error && !json.active ? json.hint || json.error : null);
      setData(json);
      if (json.match_id) matchIdRef.current = json.match_id;
    } catch {
      setError("拉取对局失败");
    } finally {
      setLoading(false);
      if (withEnrich) setEnriching(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let enrichTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await fetchMatch(false);
      if (cancelled) return;
      enrichTimer = setTimeout(() => {
        if (!cancelled) void fetchMatch(true);
      }, 600);
    };

    void tick();
    const interval = setInterval(() => {
      void fetchMatch(matchIdRef.current ? true : false);
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (enrichTimer) clearTimeout(enrichTimer);
    };
  }, [fetchMatch]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        检测本机对局…
      </div>
    );
  }

  if (error && !data?.active) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a2332]/80 p-3">
        <p className="text-xs font-medium text-gray-300">对局认人</p>
        <p className="mt-1 text-[11px] leading-5 text-gray-500">{error}</p>
        <p className="mt-2 text-[10px] text-gray-600">
          仅支持本机开游戏时使用 ·{" "}
          <a href="/live" className="text-[#ff4655] hover:underline">
            打开完整面板
          </a>
        </p>
      </div>
    );
  }

  if (!data?.active) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a2332]/80 p-3">
        <p className="text-xs font-medium text-gray-300">对局认人</p>
        <p className="mt-1 text-[11px] text-gray-500">
          {data?.hint || "进入选人或对局后自动识别 10 人"}
        </p>
        <button
          type="button"
          onClick={() => void fetchMatch(true)}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-white"
        >
          <RefreshCw size={10} /> 刷新
        </button>
      </div>
    );
  }

  const allies = data.players.filter((p) => p.is_ally);
  const enemies = data.players.filter((p) => !p.is_ally);

  return (
    <div
      className={`rounded-xl border border-[#ff4655]/20 bg-[#1a2332]/90 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff4655]">
            对局认人
          </p>
          <p className="text-sm font-bold text-white">
            {PHASE_LABEL[data.phase] || data.phase}
            {data.map_name ? ` · ${data.map_name}` : ""}
          </p>
          <p className="text-[10px] text-gray-500">
            {buildPartySummary(data.parties)}
            {enriching ? " · 分析中…" : data.enriched ? " · 已分析" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMatch(true)}
          disabled={enriching}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5"
        >
          <RefreshCw size={10} className={enriching ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {data.parties.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {data.parties.map((g) => {
            const palette = partyPalette(g.party_index);
            return (
              <span
                key={g.party_id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${palette?.chip || "border-sky-500/25 bg-sky-500/10 text-sky-200"}`}
              >
                <Users size={10} />
                {g.is_ally ? "己方" : "敌方"} {partyLetter(g.party_index)}组 ·{" "}
                {g.size}黑
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SideColumn
          title="己方"
          titleClass="text-emerald-400/80"
          players={allies}
        />
        <SideColumn
          title="敌方"
          titleClass="text-rose-400/80"
          players={enemies}
        />
      </div>

      {!compact ? (
        <p className="mt-3 text-[9px] leading-4 text-gray-600">
          每个 PartyID 对应独立组队（A/B/C 组颜色不同）。同一侧可有多个组队 + 多个单排。炸鱼/可疑评分为历史启发式，仅供参考。
        </p>
      ) : (
        <a
          href="/live"
          className="mt-2 inline-block text-[10px] text-[#ff4655] hover:underline"
        >
          打开完整对局面板 →
        </a>
      )}
    </div>
  );
}
