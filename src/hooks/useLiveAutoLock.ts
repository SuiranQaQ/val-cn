"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickAutoLockDelayMs,
  readAutoLockDelayRange,
  sleep,
  writeAutoLockDelayRange,
} from "@/lib/live-auto-lock-delay";
import {
  readAutoLockEnabled,
  readPreferredAgentId,
  writeAutoLockEnabled,
  writePreferredAgentId,
} from "@/lib/live-auto-lock-storage";

export interface AutoLockMatchContext {
  active?: boolean;
  phase?: "pregame" | "ingame" | "none";
  match_id?: string;
  players?: Array<{
    is_me?: boolean;
    agent_id?: string;
    agent_selection_state?: string;
  }>;
}

import type { AgentRole } from "@/lib/agent-roles";

export interface AgentOption {
  id: string;
  name: string;
  icon: string;
  role?: AgentRole | null;
}

export function useLiveAutoLock(options?: {
  match?: AutoLockMatchContext | null;
  onAfterLock?: () => void | Promise<void>;
}) {
  const match = options?.match;
  const onAfterLock = options?.onAfterLock;

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [preferredAgentId, setPreferredAgentId] = useState("");
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockWaitLabel, setLockWaitLabel] = useState("");
  const [delayMin, setDelayMin] = useState(350);
  const [delayMax, setDelayMax] = useState(950);

  const autoLockSuccessRef = useRef("");
  const autoLockDelayDoneRef = useRef("");
  const autoLockInFlightRef = useRef(false);

  useEffect(() => {
    setPreferredAgentId(readPreferredAgentId());
    setAutoLockEnabled(readAutoLockEnabled());
    const range = readAutoLockDelayRange();
    setDelayMin(range.min);
    setDelayMax(range.max);
    fetch("/api/live/agents")
      .then((r) => r.json())
      .then((j: { agents?: AgentOption[] }) => setAgents(j.agents || []))
      .catch(() => {});
  }, []);

  const handleSelectAgent = useCallback((id: string) => {
    setPreferredAgentId(id);
    writePreferredAgentId(id);
  }, []);

  const handleToggleAutoLock = useCallback((enabled: boolean) => {
    setAutoLockEnabled(enabled);
    writeAutoLockEnabled(enabled);
  }, []);

  const saveDelayRange = useCallback((min: number, max: number) => {
    const lo = Math.max(0, Math.round(min));
    const hi = Math.max(lo + 50, Math.round(max));
    setDelayMin(lo);
    setDelayMax(hi);
    writeAutoLockDelayRange(lo, hi);
  }, []);

  const runAutoLock = useCallback(
    async (agentId: string, matchId: string, skipDelay = false) => {
      if (!agentId || !matchId || autoLockInFlightRef.current) return;
      const successKey = `${matchId}:${agentId}`;
      if (autoLockSuccessRef.current === successKey) return;

      autoLockInFlightRef.current = true;
      try {
        const delayKey = `${matchId}:${agentId}`;
        if (!skipDelay && autoLockDelayDoneRef.current !== delayKey) {
          autoLockDelayDoneRef.current = delayKey;
          const delayMs = pickAutoLockDelayMs();
          setLockWaitLabel(`${(delayMs / 1000).toFixed(1)}s 后锁定…`);
          await sleep(delayMs);
          setLockWaitLabel("");
        }

        setLocking(true);
        setLockError(null);
        const res = await fetch("/api/live-match/auto-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          status?: string;
          detail?: string;
          error?: string;
        };
        if (json.ok || json.status === "already_locked") {
          autoLockSuccessRef.current = successKey;
          setLockError(null);
          await onAfterLock?.();
        } else {
          setLockError(
            json.detail || json.error || json.status || "锁定失败",
          );
        }
      } catch {
        setLockError("请求失败");
      } finally {
        autoLockInFlightRef.current = false;
        setLocking(false);
        setLockWaitLabel("");
      }
    },
    [onAfterLock],
  );

  useEffect(() => {
    autoLockSuccessRef.current = "";
    autoLockDelayDoneRef.current = "";
    setLockError(null);
    setLockWaitLabel("");
  }, [preferredAgentId]);

  useEffect(() => {
    if (
      match?.match_id &&
      match.match_id !== autoLockSuccessRef.current.split(":")[0]
    ) {
      autoLockSuccessRef.current = "";
      autoLockDelayDoneRef.current = "";
      setLockError(null);
      setLockWaitLabel("");
    }
  }, [match?.match_id]);

  useEffect(() => {
    if (!match?.active || match.phase !== "pregame") return;
    if (!autoLockEnabled || !preferredAgentId || !match.match_id) return;

    const me = match.players?.find((p) => p.is_me);
    if (
      me?.agent_selection_state === "locked" &&
      me.agent_id === preferredAgentId
    ) {
      return;
    }

    void runAutoLock(preferredAgentId, match.match_id);
  }, [
    match?.active,
    match?.phase,
    match?.match_id,
    match?.players,
    autoLockEnabled,
    preferredAgentId,
    runAutoLock,
  ]);

  useEffect(() => {
    if (!match?.active || match.phase !== "pregame") return;
    if (!autoLockEnabled || !preferredAgentId || !match.match_id) return;

    const me = match.players?.find((p) => p.is_me);
    if (
      me?.agent_selection_state === "locked" &&
      me.agent_id === preferredAgentId
    ) {
      return;
    }

    const id = setInterval(() => {
      void runAutoLock(preferredAgentId, match.match_id!);
    }, 2500);
    return () => clearInterval(id);
  }, [
    match?.active,
    match?.phase,
    match?.match_id,
    match?.players,
    autoLockEnabled,
    preferredAgentId,
    runAutoLock,
  ]);

  const myLockState = (() => {
    const me = match?.players?.find((p) => p.is_me);
    if (!me) return "" as const;
    if (me.agent_selection_state === "locked" || me.agent_selection_state === "selected") {
      return me.agent_selection_state;
    }
    if (me.agent_id && match?.phase === "pregame") return "locked" as const;
    return "" as const;
  })();

  return {
    agents,
    preferredAgentId,
    autoLockEnabled,
    locking,
    lockError,
    lockWaitLabel,
    delayMin,
    delayMax,
    myLockState,
    handleSelectAgent,
    handleToggleAutoLock,
    saveDelayRange,
    runManualLock: () => {
      if (!match?.match_id || !preferredAgentId) return;
      void runAutoLock(preferredAgentId, match.match_id, true);
    },
  };
}
