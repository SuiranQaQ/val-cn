/**
 * 大厅组队 / 匹配状态（parties GLZ API）
 * 来源：Companion live-traffic 捕获的 /parties/v1/*
 */

import { subjectFromSession } from "./riot-account";
import { glzFetch } from "./glz-fetch";
import { getQueueDisplayName } from "./live-queue-label";
import { getRiotSession } from "./riot-session";

export interface LivePartyStatus {
  party_id: string;
  state: string;
  queue_id: string;
  queue_name: string;
  member_count: number;
  estimated_queue_seconds: number;
  queue_elapsed_seconds: number;
  in_queue: boolean;
}

const PARTY_QUEUE_STATES = new Set([
  "MATCHMAKING",
  "STARTING_MATCHMAKING",
  "FINDING_MATCH",
  "ENTERING_MATCH",
]);

function partyStateLabel(state: string): string {
  const s = state.toUpperCase();
  if (PARTY_QUEUE_STATES.has(s)) return "匹配中";
  if (s === "DEFAULT" || s === "IDLE") return "大厅";
  if (s === "MATCH_FOUND") return "找到对局";
  if (s === "IN_GAME" || s === "PLAYING") return "对局中";
  return state || "大厅";
}

export async function fetchLivePartyStatus(): Promise<LivePartyStatus | null> {
  const session = await getRiotSession();
  const subject = session ? subjectFromSession(session) : null;
  if (!subject) return null;

  try {
    const playerRes = await glzFetch(
      `/parties/v1/players/${encodeURIComponent(subject)}`,
    );
    if (!playerRes.ok) return null;

    const playerData = (await playerRes.json()) as Record<string, unknown>;
    const partyId = String(
      playerData.CurrentPartyID ||
        playerData.currentPartyId ||
        playerData.PartyID ||
        "",
    ).trim();
    if (!partyId) return null;

    const partyRes = await glzFetch(
      `/parties/v1/parties/${encodeURIComponent(partyId)}`,
    );
    if (!partyRes.ok) return null;

    const party = (await partyRes.json()) as Record<string, unknown>;
    const state = String(party.State || party.state || "").trim();
    const queueId = String(
      (party.MatchmakingData as Record<string, unknown> | undefined)?.QueueID ||
        (party.MatchmakingData as Record<string, unknown> | undefined)
          ?.queueId ||
        "",
    ).trim();
    const members = (party.Members || party.members || []) as unknown[];
    const queueEntry = String(party.QueueEntryTime || party.queueEntryTime || "");
    let queueElapsed = 0;
    if (queueEntry) {
      queueElapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(queueEntry).getTime()) / 1000),
      );
    }

    const inQueue = PARTY_QUEUE_STATES.has(state.toUpperCase());

    return {
      party_id: partyId,
      state: partyStateLabel(state),
      queue_id: queueId,
      queue_name: getQueueDisplayName(queueId),
      member_count: members.length,
      estimated_queue_seconds: Number(
        party.EstimatedQueueTimeSeconds ??
          party.estimatedQueueTimeSeconds ??
          0,
      ),
      queue_elapsed_seconds: inQueue ? queueElapsed : 0,
      in_queue: inQueue,
    };
  } catch {
    return null;
  }
}
