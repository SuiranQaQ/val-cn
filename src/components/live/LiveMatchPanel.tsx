"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { GameIcon } from "@/components/report/GameIcon";
import { LiveMatchBriefPanel } from "@/components/live/LiveMatchBrief";
import { LiveMatchArena } from "@/components/live/LiveMatchArena";
import { BehaviorGuardBanner } from "@/components/live/BehaviorGuardBanner";
import { useLiveAutoLock } from "@/hooks/useLiveAutoLock";
import { type AgentRole } from "@/lib/agent-roles";
import { buildLiveMatchBrief } from "@/lib/live-match-brief";
import {
  ARCHETYPE_CLASS,
  ARCHETYPE_LABEL,
  ARCHETYPE_TOOLTIP,
  classifyPlayerArchetype,
  type PlayerArchetypeResult,
} from "@/lib/live-player-label";
import { isCharacterSelectActive } from "@/lib/live-phase";

interface PlayerEnrich {
  name: string;
  recent_games: number;
  wins: number;
  win_rate: number;
  avg_acs: number;
  avg_kda: number;
  avg_kd: number;
  headshot_pct: number;
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
  agent_selection_state?: "" | "selected" | "locked";
  player_card_id?: string;
  agent_icon?: string;
  player_card_art?: string;
  rank_icon?: string;
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
  map_splash?: string;
  mode: string;
  state: string;
  pregame_state?: string;
  enemy_pending_count?: number;
  parties: LivePartyGroup[];
  players: LivePlayerRow[];
  enriched?: boolean;
  hint?: string;
  error?: string;
}

interface PartyQueueStatus {
  state: string;
  queue_name: string;
  member_count: number;
  in_queue: boolean;
  queue_elapsed_seconds: number;
  estimated_queue_seconds: number;
}

import type { BehaviorGuardStatus } from "@/lib/behavior-guard";

const PHASE_LABEL: Record<string, string> = {
  pregame: "选人阶段",
  ingame: "对局进行中",
  none: "未在匹配中",
};

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

function selectionLabel(state?: string, hasAgent?: boolean): { text: string; className: string } {
  if (state === "locked") {
    return { text: "已锁定", className: "text-emerald-300 bg-emerald-500/15" };
  }
  if (state === "selected" || hasAgent) {
    return { text: "已选择", className: "text-amber-300 bg-amber-500/15" };
  }
  return { text: "未选", className: "text-gray-500 bg-white/5" };
}

function PlayerArchetypeBadge({
  archetype,
}: {
  archetype: PlayerArchetypeResult | null;
}) {
  if (!archetype) return null;
  const tip = [ARCHETYPE_TOOLTIP, archetype.hint].filter(Boolean).join(" · ");
  return (
    <span
      title={tip}
      className={`rounded border px-1 py-0.5 text-[8px] font-semibold ${ARCHETYPE_CLASS[archetype.type]}`}
    >
      {ARCHETYPE_LABEL[archetype.type]}
    </span>
  );
}

function PlayerProfileTags({ player }: { player: LivePlayerRow }) {
  const enrich = player.enrich;
  const archetype = classifyPlayerArchetype({
    account_level: player.account_level,
    rank_tier: player.rank_tier,
    enrich,
  });
  const smurfScore = enrich?.loaded ? enrich.smurf_score ?? 0 : 0;
  const showSmurf = smurfScore >= 28;

  if (!archetype && !showSmurf) return null;

  return (
    <>
      {archetype ? <PlayerArchetypeBadge archetype={archetype} /> : null}
      {showSmurf ? (
        <span
          title={`炸鱼嫌疑 ${smurfScore}，仅供参考 · ${ARCHETYPE_TOOLTIP}`}
          className="rounded border border-amber-500/30 bg-amber-500/12 px-1 py-0.5 text-[8px] font-semibold text-amber-300/95"
        >
          炸鱼 {smurfScore}
        </span>
      ) : null}
    </>
  );
}

function PlayerAvatar({
  player,
  showLockedRing,
}: {
  player: LivePlayerRow;
  showLockedRing?: boolean;
}) {
  const locked =
    showLockedRing &&
    (player.agent_selection_state === "locked" ||
      player.agent_selection_state === "selected");
  return (
    <div className="relative shrink-0">
      <div
        className={`h-9 w-9 overflow-hidden rounded-md border bg-[#0f1419] ${
          locked ? "border-emerald-500/50" : "border-white/10"
        }`}
      >
        {player.agent_icon ? (
          <GameIcon
            src={player.agent_icon}
            alt={player.agent_name}
            size={36}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[8px] text-gray-600">
            未选
          </div>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 rounded border border-[#1a2332] bg-[#1a2332]">
        {player.rank_icon ? (
          <GameIcon src={player.rank_icon} alt={player.rank_name} size={18} />
        ) : (
          <div className="flex h-[18px] w-[18px] items-center justify-center rounded bg-white/5 text-[7px] text-gray-500">
            —
          </div>
        )}
      </div>
    </div>
  );
}

function AgentSelectionBadge({
  state,
  show,
  hasAgent,
}: {
  state?: string;
  show: boolean;
  hasAgent?: boolean;
}) {
  if (!show) return null;
  const effectiveState = state || (hasAgent ? "locked" : "");
  const sel = selectionLabel(effectiveState, hasAgent);
  return (
    <span
      className={`rounded px-1 py-0.5 text-[8px] font-medium ${sel.className}`}
    >
      {sel.text}
    </span>
  );
}

function PlayerRow({
  player,
  partyRowClass,
  showAgentSelection,
  phase,
}: {
  player: LivePlayerRow;
  partyRowClass?: string;
  showAgentSelection: boolean;
  phase: LiveMatchData["phase"];
}) {
  const name =
    player.enrich?.name || player.name || `${player.subject.slice(0, 8)}…`;
  const enrich = player.enrich;
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
      <div className="flex items-start gap-2">
        <PlayerAvatar player={player} showLockedRing={showAgentSelection} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <p className="truncate text-xs font-semibold text-white">
              {name}
              {player.is_me ? (
                <span className="ml-1 text-[9px] text-[#ff4655]">我</span>
              ) : null}
            </p>
            <AgentSelectionBadge
              state={player.agent_selection_state}
              show={showAgentSelection}
              hasAgent={!!player.agent_id}
            />
            <PlayerProfileTags player={player} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-gray-500">
            <span className="font-medium text-gray-300">
              {player.agent_name}
            </span>
            <span>· Lv.{player.account_level || "?"}</span>
            <span>· {player.rank_name}</span>
            {partyLabel ? (
              <span
                className={`${palette?.chip.split(" ").find((c) => c.startsWith("text-")) || "text-sky-400"}`}
              >
                · {partyLabel}
              </span>
            ) : (
              <span className="text-gray-600">· 单排</span>
            )}
          </p>
          {enrich?.loaded ? (
            <p className="mt-0.5 text-[9px] text-gray-500">
              近{enrich.recent_games}场 {enrich.win_rate}%胜 · ACS{" "}
              {enrich.avg_acs || "—"} · KDA {enrich.avg_kda || "—"}
            </p>
          ) : enrich === null ? null : (
            <Loader2 size={10} className="mt-0.5 animate-spin text-gray-600" />
          )}
        </div>
      </div>
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

function EnemyPendingSlots({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-dashed border-rose-500/20 bg-rose-500/[0.03] px-2 py-2 text-[9px] text-gray-500"
        >
          敌方 #{i + 1} · 游戏尚未 reveal（对面选完或进行一段时间后会显示）
        </div>
      ))}
    </div>
  );
}

function SideColumn({
  title,
  titleClass,
  players,
  showAgentSelection,
  phase,
  pendingCount = 0,
}: {
  title: string;
  titleClass: string;
  players: LivePlayerRow[];
  showAgentSelection: boolean;
  phase: LiveMatchData["phase"];
  pendingCount?: number;
}) {
  const { groups, solos } = groupSidePlayers(players);

  return (
    <div>
      <p className={`mb-1.5 text-[9px] uppercase tracking-wider ${titleClass}`}>
        {title} ({players.length}
        {pendingCount > 0 ? ` +${pendingCount} 待显示` : ""})
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
                  showAgentSelection={showAgentSelection}
                  phase={phase}
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
              <PlayerRow
                key={p.subject}
                player={p}
                showAgentSelection={showAgentSelection}
                phase={phase}
              />
            ))}
          </div>
        ) : null}
        <EnemyPendingSlots count={pendingCount} />
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
  const [partyStatus, setPartyStatus] = useState<PartyQueueStatus | null>(null);
  const [behaviorGuard, setBehaviorGuard] = useState<BehaviorGuardStatus | null>(
    null,
  );
  const enrichedMatchIdRef = useRef("");
  const lastEndedMatchIdRef = useRef("");
  const enrichInFlightRef = useRef(false);
  const knownSubjectsRef = useRef<Set<string>>(new Set());
  const phaseRef = useRef<LiveMatchData["phase"]>("none");

function selectionRank(state?: string): number {
  if (state === "locked") return 2;
  if (state === "selected") return 1;
  return 0;
}

function mergePlayerRow(
  incoming: LivePlayerRow,
  prev?: {
    enrich?: PlayerEnrich;
    name?: string;
    agent_selection_state?: LivePlayerRow["agent_selection_state"];
    agent_id?: string;
    agent_icon?: string;
    agent_name?: string;
  },
): LivePlayerRow {
  if (!prev) return incoming;

  const agentId = incoming.agent_id || prev.agent_id || "";
  let agentState: LivePlayerRow["agent_selection_state"] =
    incoming.agent_selection_state || "";
  if (selectionRank(prev.agent_selection_state) > selectionRank(agentState)) {
    agentState = prev.agent_selection_state || agentState;
  }
  if (!agentState && agentId) {
    agentState = "locked";
  }

  return {
    ...incoming,
    enrich: prev.enrich?.loaded ? prev.enrich : incoming.enrich,
    name: incoming.name || prev.name,
    agent_id: agentId,
    agent_icon: incoming.agent_icon || prev.agent_icon,
    agent_name:
      incoming.agent_name !== "未选" ? incoming.agent_name : prev.agent_name || incoming.agent_name,
    agent_selection_state: agentState,
  };
}

  function mergePlayerEnrich(
    incoming: LiveMatchData,
    prev: LiveMatchData | null,
  ): LiveMatchData {
    if (incoming.enriched) return incoming;
    if (!prev?.players.length) return incoming;

    const kept = new Map(
      prev.players.map((p) => [
        p.subject,
        {
          enrich: p.enrich?.loaded ? p.enrich : undefined,
          name: p.name,
          agent_selection_state: p.agent_selection_state,
          agent_id: p.agent_id,
          agent_icon: p.agent_icon,
          agent_name: p.agent_name,
        },
      ]),
    );

    return {
      ...incoming,
      enriched: prev.enriched,
      players: incoming.players.map((p) =>
        mergePlayerRow(p, kept.get(p.subject)),
      ),
    };
  }

  const fetchMatch = useCallback(
    async (mode: "fast" | "enrich") => {
      const withEnrich = mode === "enrich";
      if (withEnrich) {
        if (enrichInFlightRef.current) return;
        enrichInFlightRef.current = true;
        setEnriching(true);
      }
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
        if (!json.active) {
          enrichedMatchIdRef.current = "";
          knownSubjectsRef.current = new Set();
          phaseRef.current = "none";
          setData((prev) => {
            if (json.match_id) {
              lastEndedMatchIdRef.current = json.match_id;
            } else if (prev?.active && prev.match_id) {
              lastEndedMatchIdRef.current = prev.match_id;
            }
            return json;
          });
        } else {
          setData((prev) => mergePlayerEnrich(json, prev));
          phaseRef.current = json.phase;
        }
        if (withEnrich && json.active && json.players?.length) {
          knownSubjectsRef.current = new Set(
            json.players.map((p) => p.subject),
          );
          if (json.enriched && json.match_id) {
            enrichedMatchIdRef.current = json.match_id;
          }
        } else if (json.active && json.enriched && json.match_id) {
          enrichedMatchIdRef.current = json.match_id;
          knownSubjectsRef.current = new Set(
            json.players.map((p) => p.subject),
          );
        }
      } catch {
        setError("拉取对局失败");
      } finally {
        setLoading(false);
        if (withEnrich) {
          enrichInFlightRef.current = false;
          setEnriching(false);
        }
      }
    },
    [],
  );

  const autoLock = useLiveAutoLock({
    match: data,
    onAfterLock: () => fetchMatch("fast"),
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchMatch("fast");
      if (!cancelled) await fetchMatch("enrich");
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMatch]);

  useEffect(() => {
    if (data?.active) {
      setPartyStatus(null);
      return;
    }
    let cancelled = false;
    const loadParty = async () => {
      try {
        const res = await fetch("/api/live-party", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          party?: PartyQueueStatus;
        };
        if (!cancelled) setPartyStatus(json.ok ? json.party || null : null);
      } catch {
        if (!cancelled) setPartyStatus(null);
      }
    };
    void loadParty();
    const id = setInterval(() => void loadParty(), 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data?.active]);

  useEffect(() => {
    let cancelled = false;
    const matchId = data?.active
      ? data.match_id
      : lastEndedMatchIdRef.current || data?.match_id || "";

    const loadGuard = async () => {
      try {
        const q = matchId ? `?match_id=${encodeURIComponent(matchId)}` : "";
        const res = await fetch(`/api/behavior-status${q}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as BehaviorGuardStatus & { ok?: boolean };
        if (!cancelled && json.ok !== false) {
          setBehaviorGuard(json);
        }
      } catch {
        if (!cancelled) setBehaviorGuard(null);
      }
    };

    void loadGuard();
    if (!data?.active && matchId) {
      const id = window.setTimeout(() => void loadGuard(), 2500);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [data?.active, data?.match_id]);

  useEffect(() => {
    if (data?.active) return;
    const id = setInterval(() => {
      void fetchMatch("fast");
    }, 3000);
    return () => clearInterval(id);
  }, [data?.active, fetchMatch]);

  useEffect(() => {
    if (!data?.active) return;
    phaseRef.current = data.phase;
    const ms =
      data.phase === "pregame" || (data.enemy_pending_count ?? 0) > 0
        ? (data.enemy_pending_count ?? 0) > 0
          ? 800
          : 1500
        : 6000;
    const id = setInterval(() => {
      void fetchMatch("fast");
    }, ms);
    return () => clearInterval(id);
  }, [data?.active, data?.phase, fetchMatch]);

  /** 新对局或敌方 reveal 出新玩家时，补一次深度分析（不跟快速轮询叠在一起） */
  useEffect(() => {
    if (!data?.active || !data.match_id) return;

    if (data.match_id !== enrichedMatchIdRef.current) {
      enrichedMatchIdRef.current = "";
      knownSubjectsRef.current = new Set();
    }

    const subjects = data.players.map((p) => p.subject);
    const hasNewPlayer = subjects.some(
      (s) => !knownSubjectsRef.current.has(s),
    );
    if (!hasNewPlayer && enrichedMatchIdRef.current === data.match_id) return;

    void fetchMatch("enrich");
  }, [data?.active, data?.match_id, data?.players, fetchMatch]);

  const roleByAgentId = useMemo(() => {
    const map = new Map<string, AgentRole>();
    for (const a of autoLock.agents) {
      if (a.role) map.set(a.id.toLowerCase(), a.role);
    }
    return map;
  }, [autoLock.agents]);

  const matchBrief = useMemo(() => {
    if (!data?.active || !data.players.length) return null;
    return buildLiveMatchBrief(data.players, roleByAgentId);
  }, [data?.active, data?.players, roleByAgentId]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        检测本机对局…
      </div>
    );
  }

  if (error && !data?.active) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="rounded-lg border border-white/10 bg-[#1a2332]/80 p-4 text-center">
          <p className="text-xs font-medium text-gray-300">对局认人</p>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data?.active) {
    const queueHint = partyStatus?.in_queue
      ? `${partyStatus.queue_name || "匹配"} · 已等待 ${partyStatus.queue_elapsed_seconds}s${
          partyStatus.estimated_queue_seconds
            ? ` · 预计 ${partyStatus.estimated_queue_seconds}s`
            : ""
        }`
      : partyStatus?.state
        ? `${partyStatus.state}${partyStatus.member_count > 1 ? ` · ${partyStatus.member_count} 人组队` : ""}`
        : null;

    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          {behaviorGuard ? (
            <BehaviorGuardBanner status={behaviorGuard} />
          ) : null}
          <div className="rounded-lg border border-white/10 bg-[#1a2332]/80 p-4 text-center">
            <p className="text-xs font-medium text-gray-300">对局认人</p>
            <p className="mt-1 text-[11px] text-gray-500">
              {data?.hint || "进入选人或对局后自动识别 10 人"}
            </p>
            {queueHint ? (
              <p className="mt-2 text-[10px] font-medium text-cyan-300/90">
                {queueHint}
              </p>
            ) : null}
            {!compact ? (
              <Link
                href="/live/lock"
                className="mt-2 inline-block text-[10px] text-[#ff4655] hover:underline"
              >
                自动锁人设置 →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void fetchMatch("enrich")}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-white"
            >
              <RefreshCw size={10} /> 刷新
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allies = data.players.filter((p) => p.is_ally);
  const enemies = data.players.filter((p) => !p.is_ally);
  const inCharacterSelect = isCharacterSelectActive({
    phase: data.phase,
    state: data.state,
    pregame_state: data.pregame_state,
  });
  const showAgentSelection = inCharacterSelect;
  const enemyPending = data.enemy_pending_count ?? 0;

  if (!compact) {
    const autoLockHint =
      autoLock.autoLockEnabled && inCharacterSelect
        ? `自动锁人${autoLock.lockWaitLabel ? ` ${autoLock.lockWaitLabel}` : ""}${autoLock.locking ? " · 锁定中" : ""}`
        : null;

    return (
      <div className="flex h-full min-h-0 flex-col">
        {behaviorGuard && behaviorGuard.risk_level !== "ok" ? (
          <div className="mb-2 shrink-0 px-1">
            <BehaviorGuardBanner status={behaviorGuard} compact />
          </div>
        ) : null}
        <LiveMatchArena
          data={{
            phase: data.phase,
            map_name: data.map_name,
            map_splash: data.map_splash,
            mode: data.mode,
            enemy_pending_count: enemyPending,
            players: data.players,
          }}
          brief={matchBrief}
          showSelection={showAgentSelection}
          phaseLabel={PHASE_LABEL[data.phase] || data.phase}
          partySummary={buildPartySummary(data.parties)}
          enriching={enriching}
          enriched={data.enriched}
          onRefresh={() => void fetchMatch("enrich")}
          autoLockHint={autoLockHint}
        />
      </div>
    );
  }

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
            {inCharacterSelect ? " · 实时刷新选人" : " · 实时同步"}
            {enriching
              ? " · 深度分析中…"
              : data.enriched
                ? " · 已分析"
                : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMatch("enrich")}
          disabled={enriching}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5"
        >
          <RefreshCw size={10} className={enriching ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {autoLock.autoLockEnabled && inCharacterSelect ? (
        <p className="mb-2 text-[10px] text-gray-500">
          自动锁人已开启
          {autoLock.lockWaitLabel ? ` · ${autoLock.lockWaitLabel}` : ""}
          {autoLock.locking ? " · 锁定中…" : ""}
          {!compact ? (
            <>
              {" · "}
              <Link href="/live/lock" className="text-[#ff4655] hover:underline">
                设置
              </Link>
            </>
          ) : null}
        </p>
      ) : !compact ? (
        <p className="mb-2 text-[10px]">
          <Link href="/live/lock" className="text-gray-500 hover:text-[#ff4655]">
            自动锁人设置 →
          </Link>
        </p>
      ) : null}

      {matchBrief ? <LiveMatchBriefPanel brief={matchBrief} /> : null}

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
          showAgentSelection={showAgentSelection}
          phase={data.phase}
        />
        <SideColumn
          title="敌方"
          titleClass="text-rose-400/80"
          players={enemies}
          showAgentSelection={showAgentSelection}
          phase={data.phase}
          pendingCount={enemyPending}
        />
      </div>

      {inCharacterSelect && enemies.length === 0 && enemyPending === 0 ? (
        <p className="mt-2 text-[10px] text-gray-500">
          敌方尚未显示：游戏会在选人进行一段时间后 reveal 对面（非本工具限制）
        </p>
      ) : null}

      {!compact ? (
        <p className="mt-3 text-[9px] leading-4 text-gray-600">
          大图标为特工，右下角为段位。自动锁定仅在选人阶段生效，需本机 Token
          有效。
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
