import { NextRequest, NextResponse } from "next/server";
import { fetchLiveMatchSnapshot } from "@/lib/live-match";
import { enrichLivePlayers } from "@/lib/live-enrich";
import { enrichLivePlayersVisual } from "@/lib/live-visual-enrich";
import { getMapDisplay } from "@/lib/game-assets";
import { getRiotSession } from "@/lib/riot-session";
import { hasLockfile } from "@/lib/name-resolve";

export const dynamic = "force-dynamic";

function sessionHint(error?: string): string | undefined {
  if (error === "session_unavailable") {
    return "请先启动 VALBOX 伴生代理并登录游戏（需 session.json）";
  }
  if (error === "session_subject_missing") {
    return "会话 Token 无效，请重新进游戏刷新 JWT";
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const enrich = request.nextUrl.searchParams.get("enrich") !== "false";
  const lockfile = await hasLockfile();
  const session = await getRiotSession();

  if (!lockfile && !session) {
    return NextResponse.json(
      {
        active: false,
        error: "session_unavailable",
        hint: sessionHint("session_unavailable"),
      },
      { status: 503 },
    );
  }

  const { snapshot, error, source } = await fetchLiveMatchSnapshot();

  if (!snapshot) {
    return NextResponse.json(
      {
        active: false,
        error: error || "live_match_unavailable",
        hint: sessionHint(error) || "无法读取对局，请确认游戏已启动",
        source,
      },
      { status: 502 },
    );
  }

  if (!snapshot.active || !snapshot.players.length) {
    return NextResponse.json({
      ...snapshot,
      players: [],
      enriched: false,
      source,
      hint:
        snapshot.phase === "none"
          ? "当前不在选人或对局中，匹配成功进入选人后会自动显示"
          : "未获取到玩家列表",
    });
  }

  const visualPlayers = await enrichLivePlayersVisual(snapshot.players);
  const mapVisual = snapshot.map_id
    ? await getMapDisplay(snapshot.map_id)
    : null;

  const mapExtras = {
    map_splash: mapVisual?.splash || "",
    map_list_icon: mapVisual?.listIcon || "",
  };

  if (!enrich) {
    return NextResponse.json({
      ...snapshot,
      ...mapExtras,
      players: visualPlayers.map((p) => ({
        ...p,
        name: `${p.subject.slice(0, 8)}…`,
        enrich: null,
      })),
      enriched: false,
      source,
    });
  }

  try {
    const enriched = await enrichLivePlayers(visualPlayers);
    const players = await enrichLivePlayersVisual(enriched);
    return NextResponse.json({
      ...snapshot,
      ...mapExtras,
      players,
      enriched: true,
      source,
    });
  } catch (err) {
    return NextResponse.json({
      ...snapshot,
      ...mapExtras,
      players: visualPlayers.map((p) => ({
        ...p,
        name: `${p.subject.slice(0, 8)}…`,
        enrich: null,
      })),
      enriched: false,
      enrich_error: err instanceof Error ? err.message : "enrich_failed",
      source,
    });
  }
}
