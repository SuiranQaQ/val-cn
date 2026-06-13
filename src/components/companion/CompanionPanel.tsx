"use client";

import { useCallback, useEffect, useState } from "react";

interface CompanionMeta {
  session_file_exists: boolean;
  updated_at: string | null;
  age_minutes: number | null;
  token_stale: boolean;
  jwt_claim_expired?: boolean;
  jwt_expired: boolean;
  session_works?: boolean;
  jwt_expires_in_minutes?: number | null;
  game_running: boolean;
  proxy_port: number;
  proxy_running: boolean;
  ca_installed_hint: boolean;
}

interface DiagnosticsPayload {
  session_ok?: boolean;
  session_source?: string;
  companion?: CompanionMeta;
}

function formatAge(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分钟前` : `${h} 小时前`;
}

function companionDetail(companion: CompanionMeta): string {
  const age = companion.updated_at
    ? `（${formatAge(companion.age_minutes)}）`
    : "";

  if (companion.session_works) {
    if (companion.game_running) {
      return `正在同步 Token${age}`;
    }
    return `Token 已缓存，可用于查战绩${age}`;
  }

  if (companion.game_running && companion.proxy_running) {
    if (companion.jwt_claim_expired) {
      return `JWT 字段已过期，等待游戏刷新 Token${age}（开一局或进匹配即可）`;
    }
    return `等待游戏产生新 Token${age}，请在大厅稍等或进匹配`;
  }

  if (companion.jwt_expired || companion.token_stale) {
    return `Token 已失效${age}，请重新启动瓦罗兰特`;
  }

  return `等待捕获 Token${age}`;
}

export function CompanionPanel({
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  embedded?: boolean;
}) {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch("/api/diagnostics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DiagnosticsPayload) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const t = setInterval(refresh, 5_000);
    return () => clearInterval(t);
  }, [refresh]);

  const companion = data?.companion;
  const proxyUp = companion?.proxy_running;
  const stale = companion?.token_stale;
  const jwtExpired = companion?.jwt_expired;
  const sessionWorks = companion?.session_works;
  const gameRunning = companion?.game_running;

  /** 本机 session.json 有效（不依赖 session_source，避免查战绩后误降级为 pool） */
  const hasLocalToken =
    !!companion?.session_file_exists &&
    (sessionWorks || (!jwtExpired && !stale));

  const tokenLive = hasLocalToken && sessionWorks && gameRunning;

  const tokenCached = hasLocalToken && sessionWorks && !gameRunning;

  const statusLabel = loading
    ? "检测中…"
    : tokenLive
      ? "已连接 · 客户端运行中"
      : tokenCached
        ? "Token 已就绪"
        : hasLocalToken && gameRunning && !sessionWorks
          ? "客户端运行中 · 验证 Token"
          : hasLocalToken && sessionWorks
            ? "Token 有效"
            : hasLocalToken && gameRunning && proxyUp
              ? "等待 Token 刷新"
              : hasLocalToken && jwtExpired
                ? "Token 已失效"
                : hasLocalToken && stale
                  ? "Token 可能过期"
                  : proxyUp
                    ? "代理运行中，等待游戏"
                    : "伴生未启动";

  const statusTone = tokenLive
    ? "border-[#3dd68c]/30 bg-[#3dd68c]/[0.07]"
    : tokenCached || sessionWorks || hasLocalToken
      ? "border-[#ffb84d]/30 bg-[#ffb84d]/[0.07]"
      : proxyUp
        ? "border-[#ffb84d]/30 bg-[#ffb84d]/[0.07]"
        : "border-white/10 bg-white/[0.03]";

  if (compact && tokenLive) {
    return (
      <p className="mt-2 text-[11px] text-[#3dd68c]">
        已连接 · Token {formatAge(companion?.age_minutes ?? null)} 更新
      </p>
    );
  }

  return (
    <div
      className={`${embedded ? "mt-0" : "mt-5"} border ${statusTone} p-4 pl-5`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: tokenLive
          ? "#3dd68c"
          : sessionWorks || hasLocalToken
            ? "#ffb84d"
            : proxyUp
              ? "#ffb84d"
              : "#4f5c64",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6d7a82]">
            内置伴生 Companion
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{statusLabel}</p>
          {!loading && companion ? (
            <p className="mt-1 text-xs leading-5 text-[#8b979f]">
              {hasLocalToken ? (
                companionDetail(companion)
              ) : proxyUp ? (
                gameRunning
                  ? "客户端已启动，等待捕获 Token…"
                  : "代理已开，请启动瓦罗兰特并进大厅"
              ) : (
                "国服需伴生代理截获 JWT，请先启动 Companion"
              )}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            refresh();
          }}
          className="shrink-0 border border-white/10 px-2 py-1 text-[10px] text-[#8b979f] hover:border-white/20 hover:text-white"
        >
          刷新
        </button>
      </div>

      {!loading && !hasLocalToken ? (
        <details className="mt-3 text-xs text-[#8b979f]">
          <summary className="cursor-pointer select-none text-[#c5cdd3] hover:text-white">
            如何启动（首次需装证书）
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-5">
            <li>
              管理员运行：<code className="text-[#ffb84d]">companion\scripts\install-ca.cmd</code>
            </li>
            <li>
              启动代理：<code className="text-[#ffb84d]">cd companion &amp;&amp; npm.cmd start -- --set-proxy</code>
            </li>
            <li>先开 Companion，再开游戏进大厅</li>
            <li>便携版：双击 <code className="text-[#ffb84d]">start-companion.bat</code></li>
          </ol>
          {!companion?.ca_installed_hint ? (
            <p className="mt-2 text-[#ffb84d]">尚未检测到根证书文件，请先完成第 1 步</p>
          ) : null}
        </details>
      ) : null}

      {!compact && companion ? (
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[#5f6c74]">
          <span>客户端 {gameRunning ? "运行中" : "未检测到"}</span>
          <span>·</span>
          <span>代理 {companion.proxy_running ? "运行中" : "未运行"}</span>
          <span>·</span>
          <span>API {sessionWorks ? "可用" : "不可用"}</span>
          <span>·</span>
          <span>端口 {companion.proxy_port}</span>
        </div>
      ) : null}
    </div>
  );
}
