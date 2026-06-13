import { LiveAutoLockSettings } from "@/components/live/LiveAutoLockSettings";
import { ClientShell } from "@/components/client/ClientShell";
import { isClientApp } from "@/lib/app-mode";
import Link from "next/link";

export default function LiveLockPage() {
  if (isClientApp()) {
    return (
      <ClientShell scrollable>
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
            选人工具
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">自动锁人设置</h1>
          <p className="mt-2 text-sm leading-6 text-[#8b979f]">
            选择首选特工、开启进选人自动锁定，并可微调随机延迟避免被抢。
          </p>
          <div className="mt-6">
            <LiveAutoLockSettings />
          </div>
        </div>
      </ClientShell>
    );
  }

  return (
    <div className="val-home-bg min-h-screen text-[#ece8e1]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/live" className="text-sm font-bold text-white">
            ← 对局认人
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-2xl font-bold text-white">自动锁人设置</h1>
        <div className="mt-6">
          <LiveAutoLockSettings />
        </div>
      </main>
    </div>
  );
}
