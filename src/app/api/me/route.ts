import { NextResponse } from "next/server";
import { isClientApp } from "@/lib/app-mode";
import { getCompanionMeta } from "@/lib/companion-meta";
import { enrichWithLoadout } from "@/lib/player-profile";
import { fetchAccountMe } from "@/lib/riot-account";
import { getRiotSession, getSessionSource } from "@/lib/riot-session";

async function attachAccountProfile(subject: string) {
  try {
    const profile = await Promise.race([
      enrichWithLoadout(subject, {}),
      new Promise<Awaited<ReturnType<typeof enrichWithLoadout>>>((resolve) =>
        setTimeout(() => resolve({}), 2_000),
      ),
    ]);
    return {
      account_level: profile.account_level || 0,
      player_card_icon: profile.player_card_icon || "",
      player_card_wide: profile.player_card_wide || "",
    };
  } catch {
    return {
      account_level: 0,
      player_card_icon: "",
      player_card_wide: "",
    };
  }
}

async function buildMeResponse(
  me: NonNullable<Awaited<ReturnType<typeof fetchAccountMe>>>,
  sessionSource: string,
  companion: Awaited<ReturnType<typeof getCompanionMeta>>,
) {
  const profile = await attachAccountProfile(me.subject);
  return NextResponse.json({
    ready: true,
    token_ready: true,
    ...me,
    ...profile,
    session_source: sessionSource,
    game_running: companion.game_running,
    companion,
  });
}

export async function GET() {
  if (!isClientApp()) {
    return NextResponse.json({ error: "client_only" }, { status: 403 });
  }

  const companion = await getCompanionMeta();
  const sessionSource = getSessionSource();
  const localCapture =
    companion.session_file_exists &&
    !companion.token_stale &&
    (companion.session_works ||
      !companion.jwt_expired ||
      companion.game_running);
  const session = await getRiotSession();

  if (!localCapture) {
    if (!session) {
      return NextResponse.json({
        ready: false,
        waiting_game: companion.proxy_running,
        message: companion.proxy_running
          ? "等待游戏启动…请打开瓦罗兰特并登录进大厅"
          : "Companion 未就绪，请确认桌面客户端已启动伴生代理",
        companion,
      });
    }

    if (sessionSource !== "lockfile") {
      return NextResponse.json({
        ready: false,
        waiting_game: companion.proxy_running,
        session_source: sessionSource,
        message: companion.proxy_running
          ? "等待游戏启动…进大厅后自动识别你的账号"
          : "尚未捕获本机 Token，请先启动游戏或检查 Companion",
        companion,
      });
    }
  }

  if (localCapture) {
    const me =
      session &&
      (await Promise.race([
        fetchAccountMe(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
      ]));

    if (me) {
      return buildMeResponse(me, sessionSource, companion);
    }

    return NextResponse.json({
      ready: true,
      token_ready: true,
      account_pending: true,
      session_source: sessionSource,
      game_running: companion.game_running,
      message: "Token 已就绪，正在识别你的游戏 ID…",
      companion,
    });
  }

  const me = await fetchAccountMe();

  if (me) {
    return buildMeResponse(me, sessionSource, companion);
  }

  return NextResponse.json({
    ready: true,
    token_ready: true,
    account_pending: true,
    session_source: sessionSource,
    game_running: companion.game_running,
    message: "Token 已就绪，正在识别你的游戏 ID…",
    companion,
  });
}
