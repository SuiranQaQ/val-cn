"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { loadFavorites, type FavoritePlayer } from "@/lib/favorites";
import { normalizeNameTag } from "@/lib/name-tag";
import {
  buildStoredPlayerReport,
  saveStoredPlayerReport,
} from "@/lib/player-report-storage";
import { randomUUID } from "@/lib/random-uuid";
import { getSessionDisplay } from "@/lib/session-label";
import { WebsiteIntroHero } from "@/components/website/WebsiteIntroHero";
import { WebsiteVideoBackground } from "@/components/website/WebsiteVideoBackground";
import { SiteBrand } from "@/components/website/SiteBrand";
import { SiteFooter } from "@/components/website/SiteFooter";
import { isClientApp } from "@/lib/app-mode";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import Link from "next/link";

function WebsiteHomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSharedSearch = useRef(false);
  const [playerInput, setPlayerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState("");
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);
  const [websiteView, setWebsiteView] = useState<"intro" | "search">("intro");
  const searchSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const session = useMemo(
    () => getSessionDisplay(sessionSource, sessionOk, poolTotal ?? undefined),
    [sessionSource, sessionOk, poolTotal],
  );

  const errorText: Record<string, string> = {
    client_not_running: "查询服务暂不可用，请稍后再试",
    session_from_lockfile_failed: "客户端 Token 读取失败，请重启游戏",
    name_resolve_failed: "名字解析失败，请检查 ID#编号",
    name_resolve_timeout: "名字解析超时，请稍后重试",
    player_not_found: "未找到该玩家，请核对游戏名与编号",
    riot_session_unavailable: "公用 Token 池暂不可用，请稍后再试",
    history_not_found:
      "拉取战绩失败（Token 过期）。请稍后再试，或下载客户端使用个人 Token",
    invalid_format: "格式：游戏名#编号",
  };

  useEffect(() => {
    fetch("/api/diagnostics")
      .then((r) => r.json())
      .then((d) => {
        setSessionOk(!!d.session_ok);
        setSessionSource(String(d.session_source || "none"));
        setPoolTotal(
          typeof d.session_pool?.total === "number" ? d.session_pool.total : null,
        );
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
        const detail = String(data.resolve_detail || "").trim();
        const base = errorText[code] || code || "查询失败";
        throw new Error(detail ? `${base}（${detail}）` : base);
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

  const handlePlayerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPlayerSearch(playerInput);
  };

  useEffect(() => {
    const q = searchParams.get("q");
    if (autoSharedSearch.current || !q || !q.includes("#")) return;
    autoSharedSearch.current = true;
    setWebsiteView("search");
    setPlayerInput(q);
    void runPlayerSearch(q);
  }, [searchParams]);

  const openWebsiteSearch = () => {
    setWebsiteView("search");
    requestAnimationFrame(() => {
      searchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const showWebsiteIntro = websiteView === "intro";

  const sessionTone =
    sessionOk === null
      ? "border-white/10 bg-white/[0.03]"
      : session.ok
        ? sessionSource === "fallback"
          ? "border-[#ffb84d]/25 bg-[#ffb84d]/[0.06]"
          : "border-[#3dd68c]/25 bg-[#3dd68c]/[0.06]"
        : "border-[#ff4655]/25 bg-[#ff4655]/[0.06]";

  return (
    <div className="val-website-shell relative min-h-screen overflow-x-hidden text-[#ece8e1]">
      {showWebsiteIntro ? <WebsiteVideoBackground /> : null}

      <header className="relative z-20 border-b border-white/[0.06] bg-[#0f1923]/35 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <SiteBrand />
          <div className="flex items-center gap-3">
            {showWebsiteIntro ? (
              <button
                type="button"
                onClick={openWebsiteSearch}
                className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#c5cdd3] transition hover:text-white sm:block"
              >
                查询战绩
              </button>
            ) : null}
            <Link
              href="/download"
              className="hidden border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#c5cdd3] hover:border-[#ff4655]/40 sm:block"
            >
              下载客户端
            </Link>
          </div>
        </div>
      </header>

      <main
        className={`relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-5 ${
          showWebsiteIntro ? "py-0" : "py-12"
        }`}
      >
        {showWebsiteIntro ? (
          <WebsiteIntroHero
            onStartSearch={openWebsiteSearch}
            poolTotal={poolTotal}
            sessionOk={sessionOk}
          />
        ) : null}

        <div
          ref={searchSectionRef}
          className={
            showWebsiteIntro
              ? "hidden"
              : "mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-4"
          }
        >
          <div className="mb-8 max-w-xl">
            <button
              type="button"
              onClick={() => setWebsiteView("intro")}
              className="mb-4 text-[11px] font-medium uppercase tracking-wider text-[#8b979f] transition hover:text-white"
            >
              ← 返回介绍
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
              查询战绩
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
              输入游戏 ID
              <span className="text-[#a8b4bc]">#编号</span>
            </h1>
          </div>

          <div
            className={`val-cut-panel relative max-w-xl border ${sessionTone} bg-[#1a242e]/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8`}
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-[#ff4655]" />
            <div className="mb-6 pl-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6d7a82]">
                查询线路
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{session.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#8b979f]">{session.detail}</p>
            </div>

            {poolTotal === 0 && sessionOk ? (
              <p className="mb-4 border-l-2 border-[#ffb84d]/60 bg-[#ffb84d]/[0.06] px-3 py-2 text-xs leading-5 text-[#e8c88a]">
                公用池暂无贡献，当前使用公开后备线路。
              </p>
            ) : null}

            <form onSubmit={handlePlayerSearch} className="space-y-4 pl-2">
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
                <p className="border-l-2 border-[#ff4655] bg-[#ff4655]/10 px-3 py-2.5 text-xs text-[#ffc9c9]">
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

          {!showWebsiteIntro ? (
            <div className="mt-8 flex max-w-xl flex-col gap-3 pl-1 text-[11px] text-[#5f6c74]">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <span>竞技战绩</span>
                <span>·</span>
                <span>段位趋势</span>
                <span>·</span>
                <span>队友统计</span>
              </div>
            </div>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function HomePage() {
  if (isClientApp()) {
    return <ClientDashboard />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0f1923] text-sm text-[#8b979f]">
          加载中…
        </div>
      }
    >
      <WebsiteHomeInner />
    </Suspense>
  );
}
