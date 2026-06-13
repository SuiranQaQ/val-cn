import { NextRequest, NextResponse } from "next/server";
import { isWebsiteApp } from "@/lib/app-mode";
import {
  getLatestPooledSession,
  getPoolStats,
  toRiotSessionResponse,
} from "@/lib/session-pool";
import { assertPoolReadAuth } from "@/lib/session-pool-crypto";

export const dynamic = "force-dynamic";

/**
 * 公用池 Token 读取（默认不公开 JWT）
 * 服务端查战绩走 session-pool.ts 内存读取，无需调此接口。
 * 若需远程同步池，请带 Header: X-Pool-Read-Key
 */
export async function GET(request: NextRequest) {
  const readKey = request.headers.get("x-pool-read-key");
  if (!assertPoolReadAuth(readKey)) {
    return NextResponse.json(
      {
        ok: false,
        error: "pool_read_forbidden",
        message: isWebsiteApp()
          ? "官网不对外暴露 JWT，请通过本站 /api/player 查询"
          : "缺少有效的 X-Pool-Read-Key",
      },
      { status: 403 },
    );
  }

  const latest = getLatestPooledSession();
  const stats = getPoolStats();

  if (!latest) {
    return NextResponse.json(
      {
        ok: false,
        error: "pool_empty",
        pool_total: stats.total,
        message: "公用池暂无可用会话，等待客户端老好人模式贡献",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...toRiotSessionResponse(latest),
    contributed_at: latest.contributed_at,
    pool_total: stats.total,
  });
}
