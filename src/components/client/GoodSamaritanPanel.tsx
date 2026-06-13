"use client";

import { getPoolContributeSiteUrl, isClientApp } from "@/lib/app-mode";
import { useGoodSamaritanContext } from "@/components/client/GoodSamaritanContext";

export function GoodSamaritanPanel({ embedded = false }: { embedded?: boolean }) {
  const { enabled, setEnabled, status, statusOk, sharing, shareNow } =
    useGoodSamaritanContext();

  if (!isClientApp()) return null;

  const site = getPoolContributeSiteUrl();

  return (
    <div
      className={`${embedded ? "mt-0" : "mt-4"} border border-white/10 bg-[#0f1923]/60 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6d7a82]">
            老好人模式
          </p>
          <p className="mt-1 text-xs leading-5 text-[#8b979f]">
            默认开启，会把本机 JWT 提交到官网公用池（{site}），帮助其他玩家零配置查战绩。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            if (next) void shareNow();
          }}
          className={`shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
            enabled
              ? "bg-[#3dd68c] text-[#0f1923]"
              : "border border-white/20 text-[#8b979f]"
          }`}
        >
          {enabled ? "已开启" : "关闭"}
        </button>
      </div>
      {status ? (
        <p
          className={`mt-2 text-[11px] ${statusOk ? "text-[#3dd68c]" : "text-[#ffb84d]"}`}
        >
          {status}
        </p>
      ) : null}
      {enabled && sharing ? (
        <p className="mt-2 text-[11px] text-[#8b979f]">正在提交…</p>
      ) : null}
    </div>
  );
}
