/**
 * 选人阶段：选特工 / 锁定（国服 glz 或 lockfile）
 */

import { glzFetch } from "./glz-fetch";
import { readLockfile, localRiotFetch } from "./riot-lockfile";

const PREGAME_POST: RequestInit = {
  method: "POST",
  body: "{}",
};

async function pregameFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const lock = await readLockfile();
  if (lock) {
    return localRiotFetch(lock, path, init);
  }
  return glzFetch(path, init, false);
}

export async function selectPregameAgent(
  matchId: string,
  agentId: string,
): Promise<{ ok: boolean; status: number; body?: string }> {
  const res = await pregameFetch(
    `/pregame/v1/matches/${encodeURIComponent(matchId)}/select/${encodeURIComponent(agentId)}`,
    PREGAME_POST,
  );
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 200) };
}

export async function lockPregameAgent(
  matchId: string,
  agentId: string,
): Promise<{ ok: boolean; status: number; body?: string }> {
  const res = await pregameFetch(
    `/pregame/v1/matches/${encodeURIComponent(matchId)}/lock/${encodeURIComponent(agentId)}`,
    PREGAME_POST,
  );
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 200) };
}

export async function autoLockAgentInPregame(input: {
  matchId: string;
  agentId: string;
  currentAgentId?: string;
  selectionState?: string;
}): Promise<{ ok: boolean; status: string; detail?: string }> {
  const { matchId, agentId, currentAgentId, selectionState } = input;

  if (selectionState === "locked" && currentAgentId === agentId) {
    return { ok: true, status: "already_locked" };
  }

  if (
    !currentAgentId ||
    currentAgentId !== agentId ||
    selectionState === ""
  ) {
    const select = await selectPregameAgent(matchId, agentId);
    if (!select.ok && select.status !== 409) {
      return {
        ok: false,
        status: "select_failed",
        detail: `${select.status}${select.body ? `: ${select.body}` : ""}`,
      };
    }
  }

  const lock = await lockPregameAgent(matchId, agentId);
  if (!lock.ok && lock.status !== 409) {
    return {
      ok: false,
      status: "lock_failed",
      detail: `${lock.status}${lock.body ? `: ${lock.body}` : ""}`,
    };
  }

  return { ok: true, status: "locked" };
}
