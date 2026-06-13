import { LiveMatchPanel } from "@/components/live/LiveMatchPanel";
import { ClientShell } from "@/components/client/ClientShell";
import { isClientApp } from "@/lib/app-mode";
import Link from "next/link";

export default function LivePage() {
  if (isClientApp()) {
    return (
      <ClientShell>
        <div className="flex h-full min-h-0 flex-col">
          <LiveMatchPanel />
        </div>
      </ClientShell>
    );
  }

  return (
    <div className="val-home-bg min-h-screen text-[#ece8e1]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="text-sm font-bold tracking-widest text-white">
            ← VAL CN
          </Link>
          <p className="text-[10px] tracking-widest text-[#6d7a82]">LIVE MATCH</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
            本机对局
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">对局认人面板</h1>
        </div>
        <LiveMatchPanel />
      </main>
    </div>
  );
}
