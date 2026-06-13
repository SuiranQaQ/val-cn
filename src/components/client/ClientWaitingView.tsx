"use client";

import { useClientReady } from "@/components/client/ClientReadyContext";

export function ClientWaitingView() {
  const { me, loading } = useClientReady();

  const message =
    me?.message ||
    "请打开瓦罗兰特并登录进大厅，Companion 会自动捕获 Token";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
          VALBOX
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">等待游戏启动</h1>

        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffb84d] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ffb84d]" />
          </span>
          <p className="text-sm font-medium text-[#ffd89a]">
            {loading && !me
              ? "正在检测连接…"
              : me?.ready || me?.token_ready
                ? "Token 已捕获"
                : me?.message?.includes("Token")
                  ? "Token 已捕获"
                  : me?.message || "等待瓦罗兰特登录"}
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#8b979f]">{message}</p>

        <div className="val-cut-panel mt-10 border border-white/10 bg-[#1a242e]/80 px-6 py-5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6d7a82]">
            启动步骤
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-[#8b979f]">
            <li>保持本客户端运行（Companion 已自动启动）</li>
            <li>打开瓦罗兰特国服并登录进大厅</li>
            <li>识别到账号后自动进入完整功能界面</li>
          </ol>
        </div>

        <p className="mt-6 text-[10px] leading-5 text-[#5f6c74]">
          关闭窗口会最小化到托盘 · 老好人模式默认开启
        </p>
      </div>
    </div>
  );
}
