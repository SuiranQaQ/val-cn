import { NextRequest, NextResponse } from "next/server";
import {
  getLastNameResolveDetail,
  getLastNameResolveSource,
  resolveNameTagToSubjectOrThrow,
} from "@/lib/name-resolve";
import { fetchPlayerHistory } from "@/lib/riot";
import { probeLockfile } from "@/lib/riot-lockfile";
import {
  getRiotSession,
  getSessionFilePathForDiagnostics,
  getSessionSource,
} from "@/lib/riot-session";
import { isWebsiteApp } from "@/lib/app-mode";
import { isValcnFallbackEnabled } from "@/lib/valcn-fallback";
import { getCompanionMeta } from "@/lib/companion-meta";
import { getLiveTrafficMeta } from "@/lib/live-traffic-meta";
import { getLiveMatchCachePath, readLiveMatchCache } from "@/lib/live-match-cache";
import { getPoolStats } from "@/lib/session-pool";

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

  const lockProbe = await probeLockfile();
  const lockfile = !!lockProbe.lock;
  const session = await getRiotSession();
  const source = getSessionSource();
  const valcnFallback = isValcnFallbackEnabled();
  const poolStats = getPoolStats();
  const website = isWebsiteApp();

  const sessionFile = getSessionFilePathForDiagnostics();
  const companion = website ? null : await getCompanionMeta();
  const liveTraffic = website ? null : getLiveTrafficMeta();
  const liveMatchCache = website ? null : readLiveMatchCache();

  const hints: string[] = [];
  if (website) {
    hints.push("官网模式：仅使用公用 Token 池与公开后备，不读取本机 session.json");
    if (source === "pool") {
      hints.push(`公用池 ${poolStats.total} 条会话`);
    } else if (source === "fallback") {
      hints.push("公用池为空或不可用，已使用公开后备");
    } else if (!session) {
      hints.push("请等待客户端老好人贡献，或开启 VALCN_FALLBACK");
    }
  } else if (source === "fallback") {
    hints.push("国服零配置模式：使用公开 Token 池查战绩与解析名字");
    if (process.platform === "win32") {
      hints.push("推荐：运行内置 Companion 捕获自己的 Token（见首页伴生状态）");
    }
  } else if (source === "file") {
    hints.push(`使用内置 Companion 会话：${sessionFile}`);
    if (companion?.updated_at) {
      hints.push(`Token 更新时间：${companion.updated_at}`);
    }
  } else if (source === "pool") {
    hints.push(`使用官网公用 Token 池（${poolStats.total} 条）`);
  } else if (source === "env") {
    hints.push("使用环境变量中的 Token");
  } else if (source === "lockfile") {
    hints.push("使用本机 lockfile（少数环境可用）");
  } else if (!session) {
    if (valcnFallback) {
      hints.push("会话获取失败，但公开后备已开启，将重试后备接口");
    } else {
      hints.push("请开启 VALCN_FALLBACK，或配置 RIOT_SESSION_FILE / 环境变量 Token");
    }
  }

  if (!lockfile && source !== "file" && !website) {
    hints.push("国服/WeGame 通常无 lockfile；名字解析走 Riot 账号接口或公开队列");
  }

  if (liveTraffic) {
    if (liveTraffic.snapshot_count > 0) {
      hints.push(
        `Companion 已捕获 ${liveTraffic.snapshot_count} 条对局快照，见 ${liveTraffic.snapshot_dir}`,
      );
    } else if (companion?.proxy_running) {
      hints.push(
        "对局探针已开启：进选人/对局后查看 live-traffic.log 与 live-snapshots 目录",
      );
    }
  }

  return NextResponse.json({
    app_mode: website ? "website" : "client",
    lockfile_found: lockfile,
    lockfile_path: lockProbe.path,
    lockfile_candidates: lockProbe.candidates,
    session_file: sessionFile,
    session_ok: !!session,
    session_source: source,
    public_fallback: valcnFallback,
    companion,
    live_traffic: liveTraffic,
    live_match_cache: liveMatchCache
      ? {
          path: getLiveMatchCachePath(),
          phase: liveMatchCache.phase,
          match_id: liveMatchCache.match_id,
          updated_at: liveMatchCache.updated_at,
        }
      : null,
    session_pool: poolStats,
    pool_encrypted: poolStats.encrypted,
    hints,
  });
}
