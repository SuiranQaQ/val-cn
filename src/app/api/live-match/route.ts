import { NextRequest, NextResponse } from "next/server";
import { fetchLiveMatchSnapshot } from "@/lib/live-match";
import { enrichLivePlayers } from "@/lib/live-enrich";
import { hasLockfile } from "@/lib/name-resolve";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const enrich = request.nextUrl.searchParams.get("enrich") !== "false";
  const lockfile = await hasLockfile();

  if (!lockfile) {
    return NextResponse.json(
      {
        active: false,
        error: "lockfile_not_found",
        hint: "请先在本机启动瓦罗兰特并登录，对局认人仅支持本机客户端",
      },
      { status: 503 },
    );
  }

  const { snapshot, error } = await fetchLiveMatchSnapshot();

  if (!snapshot) {
    return NextResponse.json(
      {
        active: false,
        error: error || "live_match_unavailable",
      },
      { status: 502 },
    );
  }

  if (!snapshot.active || !snapshot.players.length) {
    return NextResponse.json({
      ...snapshot,
      players: [],
      enriched: false,
      hint:
        snapshot.phase === "none"
          ? "当前不在选人或对局中，进入匹配队列后再刷新"
          : "未获取到玩家列表",
    });
  }

  if (!enrich) {
    return NextResponse.json({
      ...snapshot,
      players: snapshot.players.map((p) => ({
        ...p,
        name: `${p.subject.slice(0, 8)}…`,
        enrich: null,
      })),
      enriched: false,
    });
  }

  try {
    const enriched = await enrichLivePlayers(snapshot.players);
    return NextResponse.json({
      ...snapshot,
      players: enriched,
      enriched: true,
    });
  } catch (err) {
    return NextResponse.json({
      ...snapshot,
      players: snapshot.players.map((p) => ({
        ...p,
        name: `${p.subject.slice(0, 8)}…`,
        enrich: null,
      })),
      enriched: false,
      enrich_error: err instanceof Error ? err.message : "enrich_failed",
    });
  }
}
