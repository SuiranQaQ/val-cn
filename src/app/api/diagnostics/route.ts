import { NextRequest, NextResponse } from "next/server";
import {
  getLastNameResolveDetail,
  getLastNameResolveSource,
  hasLockfile,
  resolveNameTagToSubjectOrThrow,
} from "@/lib/name-resolve";
import { fetchPlayerHistory } from "@/lib/riot";
import { getRiotSession, getSessionSource } from "@/lib/riot-session";
import { isValcnFallbackEnabled } from "@/lib/valcn-fallback";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (q) {
    try {
      const subject = await resolveNameTagToSubjectOrThrow(q);
      const historyRes = await fetchPlayerHistory(subject, 0, 5).then(
        (data) => ({
          ok: true as const,
          total: Number(data?.Total || 0),
        }),
        (err: unknown) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : "history_failed",
        }),
      );
      return NextResponse.json({
        query: q,
        subject,
        resolve_source: getLastNameResolveSource(),
        resolve_detail: getLastNameResolveDetail(),
        history: historyRes,
      });
    } catch (err) {
      return NextResponse.json(
        {
          query: q,
          error: err instanceof Error ? err.message : "resolve_failed",
          resolve_source: getLastNameResolveSource(),
          resolve_detail: getLastNameResolveDetail(),
        },
        { status: 502 },
      );
    }
  }

  const lockfile = await hasLockfile();
  const session = await getRiotSession();
  const source = getSessionSource();
  const valcnFallback = isValcnFallbackEnabled();

  const hints: string[] = [];
  if (source === "valcn") {
    hints.push(
      "未开游戏：借用 valcn.top 公开 Token 查战绩（免费后备，非付费账户）",
    );
  } else if (!lockfile && !session) {
    if (valcnFallback) {
      hints.push("本机无客户端，将尝试 valcn 公开后备接口");
    } else {
      hints.push("请先启动瓦罗兰特客户端并登录");
      hints.push("或在 .env.local 填入 Token");
    }
  } else if (lockfile && !session) {
    hints.push("客户端在运行但 Token 读取失败，请重启游戏");
  } else if (source === "lockfile") {
    hints.push("使用本机客户端，环境就绪");
  } else if (source === "env") {
    hints.push("使用 .env.local 中的 Token");
  }

  return NextResponse.json({
    lockfile_found: lockfile,
    session_ok: !!session,
    session_source: source,
    valcn_fallback: valcnFallback,
    hints,
  });
}
