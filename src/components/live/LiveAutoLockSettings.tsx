"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { GameIcon } from "@/components/report/GameIcon";
import { useLiveAutoLock } from "@/hooks/useLiveAutoLock";
import { isCharacterSelectActive } from "@/lib/live-phase";

interface MatchStatus {
  active: boolean;
  phase: "pregame" | "ingame" | "none";
  match_id: string;
  state: string;
  pregame_state?: string;
  players: Array<{
    is_me?: boolean;
    agent_id?: string;
    agent_selection_state?: string;
  }>;
}

export function LiveAutoLockSettings() {
  const [expanded, setExpanded] = useState(true);
  const [match, setMatch] = useState<MatchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/live-match?enrich=false", {
        cache: "no-store",
      });
      const json = (await res.json()) as MatchStatus;
      setMatch(json);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(() => void fetchStatus(), 2000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const lock = useLiveAutoLock({
    match,
    onAfterLock: fetchStatus,
  });

  const selected = lock.agents.find((a) => a.id === lock.preferredAgentId);
  const inSelect =
    match?.active &&
    isCharacterSelectActive({
      phase: match.phase,
      state: match.state,
      pregame_state: match.pregame_state,
    });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#ff4655]/25 bg-[#1a2332]/90 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {selected?.icon ? (
              <GameIcon src={selected.icon} alt={selected.name} size={40} />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[10px] text-gray-600">
                特工
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff4655]">
                首选特工
              </p>
              <p className="text-lg font-bold text-white">
                {selected?.name || "未选择"}
              </p>
              <p className="text-[10px] text-gray-500">
                {inSelect
                  ? lock.myLockState === "locked"
                    ? "本局已锁定"
                    : lock.lockWaitLabel ||
                      (lock.locking ? "锁定中…" : "选人阶段 · 可自动/手动锁")
                  : match?.active
                    ? "不在选人阶段"
                    : "进入匹配选人后生效"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchStatus()}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5"
          >
            <RefreshCw size={10} />
            刷新状态
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
          <input
            type="checkbox"
            checked={lock.autoLockEnabled}
            onChange={(e) => lock.handleToggleAutoLock(e.target.checked)}
            className="rounded border-white/20"
          />
          <div>
            <p className="text-sm font-medium text-white">进选人自动锁定</p>
            <p className="text-[10px] text-gray-500">
              随机延迟约 {lock.delayMin}–{lock.delayMax} ms，降低秒锁特征
            </p>
          </div>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            延迟下限 (ms)
            <input
              type="number"
              min={0}
              max={5000}
              value={lock.delayMin}
              onChange={(e) =>
                lock.saveDelayRange(
                  Number(e.target.value),
                  lock.delayMax,
                )
              }
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            />
          </label>
          <label className="text-[10px] text-gray-500">
            延迟上限 (ms)
            <input
              type="number"
              min={100}
              max={8000}
              value={lock.delayMax}
              onChange={(e) =>
                lock.saveDelayRange(
                  lock.delayMin,
                  Number(e.target.value),
                )
              }
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!inSelect || !lock.preferredAgentId || lock.locking}
            onClick={lock.runManualLock}
            className="inline-flex items-center gap-1.5 rounded border border-[#ff4655]/40 bg-[#ff4655]/10 px-3 py-2 text-xs font-medium text-[#ff4655] hover:bg-[#ff4655]/20 disabled:opacity-50"
          >
            {lock.locking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Lock size={14} />
            )}
            立即锁定（无延迟）
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            选择特工
          </button>
        </div>

        {lock.lockError ? (
          <p className="mt-2 text-[11px] text-amber-400">{lock.lockError}</p>
        ) : null}
      </div>

      {expanded ? (
        <div className="rounded-xl border border-white/10 bg-[#1a2332]/80 p-3">
          <p className="mb-2 text-[10px] font-medium text-gray-400">
            点击选择首选特工
          </p>
          {lock.agents.length === 0 && loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              加载特工列表…
            </div>
          ) : (
            <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
              {lock.agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  onClick={() => lock.handleSelectAgent(a.id)}
                  className={`rounded border p-1 transition ${
                    lock.preferredAgentId === a.id
                      ? "border-[#ff4655] bg-[#ff4655]/15"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <GameIcon
                    src={a.icon}
                    alt={a.name}
                    size={36}
                    className="mx-auto"
                  />
                  <p className="mt-0.5 truncate text-center text-[8px] text-gray-400">
                    {a.name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <p className="text-[10px] leading-5 text-gray-600">
        设置保存在本机。对局认人页在后台也会读取同一配置并自动锁定。
        <Link href="/live" className="ml-1 text-[#ff4655] hover:underline">
          返回对局认人 →
        </Link>
      </p>
    </div>
  );
}
