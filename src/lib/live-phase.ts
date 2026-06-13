import type { LivePhase } from "./live-match";

/** 是否仍在选人阶段（局内 IN_PROGRESS 不再显示选锁状态） */
export function isCharacterSelectActive(input: {
  phase: LivePhase;
  state: string;
  pregame_state?: string;
}): boolean {
  const matchState = input.state.toUpperCase();
  if (matchState === "IN_PROGRESS") return false;

  const pregameState = (input.pregame_state || "").toLowerCase();
  if (pregameState.includes("character_select")) return true;

  return input.phase === "pregame";
}
