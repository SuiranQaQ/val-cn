"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ClientShell } from "@/components/client/ClientShell";
import { loadFavorites, type FavoritePlayer } from "@/lib/favorites";
import { normalizeNameTag } from "@/lib/name-tag";
import {
  buildStoredPlayerReport,
  saveStoredPlayerReport,
} from "@/lib/player-report-storage";
import { randomUUID } from "@/lib/random-uuid";
import { getSessionDisplay } from "@/lib/session-label";

function ClientSearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoRun = useRef(false);
  const [playerInput, setPlayerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState("");
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);

  const session = getSessionDisplay(sessionSource, sessionOk);

  const errorText: Record<string, string> = {
    client_not_running: "请先启动瓦罗兰特并登录，或等待 Companion 捕获 Token",
    session_from_lockfile_failed: "客户端 Token 读取失败，请重启游戏",
    name_resolve_failed: "名字解析失败，请检查 ID#编号",
    name_resolve_timeout: "名字解析超时，请稍后重试",
    player_not_found: "未找到该玩家，请核对游戏名与编号",
    riot_session_unavailable: "无可用会话，请启动游戏或检查 Companion",
    history_not_found: "拉取战绩失败，请重启 Companion 并进游戏",
    invalid_format: "格式：游戏名#编号",
  };

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  useEffect(() => {
    fetch("/api/diagnostics")
      .then((r) => r.json())
      .then((d) => {
        setSessionOk(!!d.session_ok);
        setSessionSource(String(d.session_source || "none"));
      })
      .catch(() => {
        setSessionOk(false);
        setSessionSource("none");
      });
  }, []);

  const runPlayerSearch = async (rawInput: string) => {
    const q = normalizeNameTag(rawInput);
    if (!q || !q.includes("#")) {
      setError("请输入：游戏名#编号");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/player?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        const code = String(data.error || "");
        throw new Error(errorText[code] || code || "查询失败");
      }

      const reportId = randomUUID();
      saveStoredPlayerReport(reportId, buildStoredPlayerReport(data, q));
      router.push(`/local/${reportId}?q=${encodeURIComponent(q)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPlayerSearch(playerInput);
  };

  useEffect(() => {
    const q = searchParams.get("q");
    if (autoRun.current || !q?.includes("#")) return;
    autoRun.current = true;
    setPlayerInput(q);
    void runPlayerSearch(q);
  }, [searchParams]);

  const sessionTone = sessionOk
    ? "border-[#3dd68c]/25 bg-[#3dd68c]/[0.06]"
    : "border-[#ff4655]/25 bg-[#ff4655]/[0.06]";

  return (
    <ClientShell scrollable>
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
          查战绩
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">搜索玩家</h1>
        <p className="mt-2 text-sm text-[#8b979f]">
          输入游戏名与编号，生成本地战绩报告。
        </p>

        <div
          className={`val-cut-panel relative mt-8 border ${sessionTone} bg-[#1a242e]/90 p-6 sm:p-8`}
        >
          <div className="absolute left-0 top-0 h-full w-1 bg-[#ff4655]" />
          <div className="mb-6 pl-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6d7a82]">
              连接状态
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{session.label}</p>
            <p className="mt-1 text-xs text-[#8b979f]">{session.detail}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pl-2">
            <div>
              <label
                htmlFor="player-query"
                className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[#6d7a82]"
              >
                玩家 ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="player-query"
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  placeholder="用户名#数字编号"
                  spellCheck={false}
                  autoComplete="off"
                  className="val-cut-input min-w-0 flex-1 border border-white/10 bg-[#0f1923] px-4 py-3.5 text-sm text-white placeholder:text-[#4f5c64] focus:border-[#ff4655]/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="val-cut-input shrink-0 bg-[#ff4655] px-8 py-3.5 text-sm font-bold uppercase text-white hover:bg-[#ff5563] disabled:opacity-50"
                >
                  {loading ? "查询中" : "查询"}
                </button>
              </div>
            </div>
            {error ? (
              <p className="border-l-2 border-[#ff4655] bg-[#ff4655]/10 px-3 py-2 text-xs text-[#ffc9c9]">
                {error}
              </p>
            ) : null}
          </form>

          {favorites.length > 0 ? (
            <div className="mt-6 border-t border-white/[0.06] pt-5 pl-2">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6d7a82]">
                收藏
              </p>
              <div className="flex flex-wrap gap-2">
                {favorites.map((f) => (
                  <button
                    key={f.subject || f.player_name}
                    type="button"
                    onClick={() => setPlayerInput(f.player_name)}
                    className="border border-white/10 bg-[#0f1923]/80 px-3 py-1.5 text-xs text-[#c5cdd3] hover:border-[#ff4655]/40"
                  >
                    {f.player_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ClientShell>
  );
}

export function ClientSearchPage() {
  return (
    <Suspense
      fallback={
        <ClientShell>
          <p className="text-sm text-[#8b979f]">加载中…</p>
        </ClientShell>
      }
    >
      <ClientSearchInner />
    </Suspense>
  );
}
