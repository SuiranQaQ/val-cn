import { NextRequest, NextResponse } from "next/server";
import { autoLockAgentInPregame } from "@/lib/live-pregame-action";
import { fetchLiveMatchSnapshot } from "@/lib/live-match";
import { getRiotSession } from "@/lib/riot-session";
import { hasLockfile } from "@/lib/name-resolve";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const lockfile = await hasLockfile();
  const session = await getRiotSession();

  if (!lockfile && !session) {
    return NextResponse.json(
      { ok: false, error: "session_unavailable" },
      { status: 503 },
    );
  }

  let agentId = "";
  try {
    const body = (await request.json()) as { agent_id?: string };
    agentId = String(body.agent_id || "").trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  if (!agentId) {
    return NextResponse.json(
      { ok: false, error: "agent_id_required" },
      { status: 400 },
    );
  }

  const { snapshot, error } = await fetchLiveMatchSnapshot();
  if (!snapshot?.active || snapshot.phase !== "pregame") {
    return NextResponse.json({
      ok: false,
      error: error || "not_in_pregame",
      phase: snapshot?.phase || "none",
    });
  }

  const me = snapshot.players.find((p) => p.is_me);
  if (!me) {
    return NextResponse.json({ ok: false, error: "player_not_in_match" });
  }

  const result = await autoLockAgentInPregame({
    matchId: snapshot.match_id,
    agentId,
    currentAgentId: me.agent_id,
    selectionState: me.agent_selection_state,
  });

  return NextResponse.json({
    ...result,
    match_id: snapshot.match_id,
    agent_id: agentId,
  });
}
