"use client";

import Link from "next/link";

interface WebsiteIntroHeroProps {
  onStartSearch: () => void;
  poolTotal: number | null;
  sessionOk: boolean | null;
}

export function WebsiteIntroHero({
  onStartSearch,
  poolTotal,
  sessionOk,
}: WebsiteIntroHeroProps) {
  const poolHint =
    poolTotal != null && poolTotal > 0
      ? `公用 Token 池 ${poolTotal} 条在线`
      : sessionOk
        ? "公开线路就绪，可直接查询"
        : "正在连接查询线路…";

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col justify-center py-10 sm:py-14 sm:-mt-6">
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#ff4655]">
          Valorant CN Tracker
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.1] text-white sm:text-6xl">
          国服无畏契约
          <br />
          <span className="bg-gradient-to-r from-white to-[#a8b4bc] bg-clip-text text-transparent">
            战绩一站查询
          </span>
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-[#c5cdd3]/90 sm:text-base">
          无需安装、无需抓包。输入游戏 ID，查看竞技战绩、段位趋势、队友统计与对局详情。
          由社区 Token 池驱动，打开浏览器即可使用。
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { title: "打开即查", desc: "网页输入 ID#编号，秒出战绩报告" },
            { title: "公用 Token 池", desc: "客户端老好人贡献，人人可用" },
            { title: "下载客户端", desc: "Companion、实时对局、个人 Token" },
          ].map((item) => (
            <li
              key={item.title}
              className="border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm"
            >
              <p className="text-sm font-bold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#9aa8b0]">{item.desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStartSearch}
            className="val-cut-input bg-[#ff4655] px-10 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#ff5563]"
          >
            查询战绩
          </button>
          <Link
            href="/download"
            className="val-cut-input border border-white/20 bg-black/30 px-10 py-4 text-center text-sm font-semibold uppercase tracking-wider text-[#ece8e1] backdrop-blur-sm transition hover:border-[#ff4655]/50"
          >
            下载客户端
          </Link>
        </div>

        <p className="mt-6 text-[11px] tracking-wide text-[#7a8790]">{poolHint}</p>
      </div>
    </section>
  );
}
