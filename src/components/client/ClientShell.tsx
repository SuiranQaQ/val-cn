"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClientTitleBar } from "@/components/client/ClientTitleBar";
import { ClientWaitingView } from "@/components/client/ClientWaitingView";
import { useClientReady } from "@/components/client/ClientReadyContext";

const NAV = [
  { href: "/", label: "我的", desc: "账号与连接" },
  { href: "/search", label: "查战绩", desc: "搜索玩家" },
  { href: "/live", label: "对局认人", desc: "本局面板" },
  { href: "/live/lock", label: "自动锁人", desc: "选人设置" },
] as const;

function meLooksReady(me: { ready?: boolean; token_ready?: boolean } | null) {
  return !!(me?.ready || me?.token_ready);
}

function ClientShellFrame({
  children,
  scrollable,
}: {
  children: ReactNode;
  scrollable: boolean;
}) {
  const pathname = usePathname();
  const { ready, loading, me } = useClientReady();
  const showWaiting = !ready && !(meLooksReady(me) && loading);

  if (showWaiting) {
    return (
      <div className="val-client-shell flex h-screen flex-col overflow-hidden bg-[#0b1419] text-[#ece8e1]">
        <ClientTitleBar />
        <ClientWaitingView />
      </div>
    );
  }

  return (
    <div className="val-client-shell flex h-screen flex-col overflow-hidden bg-[#0b1419] text-[#ece8e1]">
      <ClientTitleBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0f1923]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-sm font-bold tracking-[0.2em] text-white">VALBOX</p>
            <p className="mt-1 text-[10px] text-[#6d7a82]">国服战绩工具</p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-sm border px-4 py-3 transition ${
                    active
                      ? "border-[#ff4655]/40 bg-[#ff4655]/10 text-white"
                      : "border-transparent text-[#8b979f] hover:border-white/10 hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-[10px] opacity-80">{item.desc}</p>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.06] p-4 text-[10px] leading-5 text-[#5f6c74]">
          Companion 自动抓 Token
          <br />
          关闭窗口缩到托盘
          </div>
        </aside>

        <main
          className={`min-h-0 min-w-0 flex-1 ${
            scrollable
              ? "overflow-y-auto px-8 py-6"
              : "overflow-hidden px-4 py-3"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function ClientShell({
  children,
  scrollable = false,
}: {
  children: ReactNode;
  scrollable?: boolean;
}) {
  return <ClientShellFrame scrollable={scrollable}>{children}</ClientShellFrame>;
}
