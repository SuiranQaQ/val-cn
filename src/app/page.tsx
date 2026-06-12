"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadFavorites, type FavoritePlayer } from "@/lib/favorites";
import { normalizeNameTag } from "@/lib/name-resolve";
import { getSessionDisplay } from "@/lib/session-label";
import { LiveMatchPanel } from "@/components/live/LiveMatchPanel";

export default function HomePage() {
  const router = useRouter();
  const [playerInput, setPlayerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState("");
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const session = useMemo(
    () => getSessionDisplay(sessionSource, sessionOk),
    [sessionSource, sessionOk],
  );

  const errorText: Record<string, string> = {
    client_not_running: "请先启动瓦罗兰特并登录，或在 .env.local 配置 Token",
    session_from_lockfile_failed: "客户端 Token 读取失败，请重启游戏",
    name_resolve_failed: "名字解析失败，请检查 ID#编号",
    name_resolve_timeout: "名字解析超时，请稍后重试",
    player_not_found: "未找到该玩家，请核对游戏名与编号",
    riot_session_unavailable: "无可用会话，请启动客户端或配置 Token",
    history_not_found: "拉取战绩失败，请稍后重试",
    invalid_format: "格式：游戏名#编号",
  };

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

  const handlePlayerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = normalizeNameTag(playerInput);
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

      const reportId = crypto.randomUUID();
      sessionStorage.setItem(
        `player_report_${reportId}`,
        JSON.stringify({
          subject: data.subject,
          player_name: q,
          rank_info: data.rank_info,
          rank_rr: data.rank_rr,
          season_id: data.season_id,
          season_name: data.season_name,
          account_level: data.account_level,
          player_card_icon: data.player_card_icon,
          player_card_wide: data.player_card_wide,
          penalties: data.penalties,
          match_ids: data.match_ids,
          match_history_total: data.match_history_total,
          rank_trend: data.rank_trend,
          updates: data.updates,
        }),
      );
      router.push(`/local/${reportId}?q=${encodeURIComponent(q)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const sessionTone =
    sessionOk === null
      ? "border-white/10 bg-white/[0.03]"
      : session.ok
        ? sessionSource === "valcn"
          ? "border-[#ffb84d]/25 bg-[#ffb84d]/[0.06]"
          : "border-[#3dd68c]/25 bg-[#3dd68c]/[0.06]"
        : "border-[#ff4655]/25 bg-[#ff4655]/[0.06]";

  return (
    <div className="val-home-bg relative min-h-screen overflow-hidden text-[#ece8e1]">
      <div
        className="pointer-events-none absolute -right-24 top-0 h-72 w-72 opacity-30"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 50%, #ff4655 0deg, transparent 120deg)",
        }}
      />
      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <header className="relative border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[#ff4655] text-xs font-black text-white">
              V
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-white">
                VAL CN
              </p>
              <p className="text-[10px] text-[#6d7a82]">国服战绩站</p>
            </div>
          </div>
          <p className="hidden text-[10px] tracking-widest text-[#6d7a82] sm:block">
            TRACKER
          </p>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col justify-center px-5 py-12">
        <div className="mb-8 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
            Valorant CN
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl">
            查战绩，
            <br />
            <span className="text-[#a8b4bc]">一眼看懂。</span>
          </h1>
        </div>

        <div
          className={`val-cut-panel relative max-w-xl border ${sessionTone} bg-[#1a242e]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8`}
        >
          <div className="absolute left-0 top-0 h-full w-1 bg-[#ff4655]" />

          <div className="mb-6 pl-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6d7a82]">
              连接状态
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {session.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#8b979f]">
              {session.detail}
            </p>
          </div>

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
                  placeholder="例：风吹散#58996"
                  spellCheck={false}
                  autoComplete="off"
                  className="val-cut-input min-w-0 flex-1 border border-white/10 bg-[#0f1923] px-4 py-3.5 text-sm text-white placeholder:text-[#4f5c64] transition focus:border-[#ff4655]/50 focus:outline-none focus:ring-1 focus:ring-[#ff4655]/30"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="val-cut-input shrink-0 bg-[#ff4655] px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#ff5563] disabled:opacity-50"
                >
                  {loading ? "查询中" : "查询"}
                </button>
              </div>
            </div>

            {error ? (
              <p className="border-l-2 border-[#ff4655] bg-[#ff4655]/10 px-3 py-2.5 text-xs leading-5 text-[#ffc9c9]">
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
                    className="border border-white/10 bg-[#0f1923]/80 px-3 py-1.5 text-xs text-[#c5cdd3] transition hover:border-[#ff4655]/40 hover:text-white"
                  >
                    {f.player_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 max-w-xl pl-1">
          <LiveMatchPanel compact />
        </div>

        <div className="mt-8 flex max-w-xl flex-wrap gap-x-6 gap-y-2 pl-1 text-[11px] text-[#5f6c74]">
          <span>竞技战绩</span>
          <span>·</span>
          <span>对局认人</span>
          <span>·</span>
          <span>队友统计</span>
          <span>·</span>
          <span>地图胜率</span>
          <span>·</span>
          <span>长图分享</span>
        </div>
      </main>
    </div>
  );
}
