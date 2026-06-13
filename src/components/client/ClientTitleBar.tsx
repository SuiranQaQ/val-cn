"use client";

import {
  closeDesktopWindow,
  minimizeDesktopWindow,
} from "@/lib/desktop-bridge";

export function ClientTitleBar() {
  return (
    <header className="relative z-[9999] flex h-10 shrink-0 items-stretch border-b border-white/[0.08] bg-[#0a1218] select-none">
      <div
        data-valbox-drag
        className="flex min-w-0 flex-1 cursor-default items-center gap-2 px-3"
      >
        <span className="pointer-events-none h-2.5 w-2.5 shrink-0 bg-[#ff4655]" />
        <span className="pointer-events-none truncate text-xs font-bold tracking-[0.2em] text-white">
          VALBOX
        </span>
      </div>

      <div className="relative z-[10000] flex shrink-0 items-stretch">
        <div
          role="button"
          tabIndex={0}
          data-valbox-action="minimize"
          aria-label="最小化"
          onClick={() => minimizeDesktopWindow()}
          className="flex h-10 w-12 cursor-pointer items-center justify-center border-l border-white/[0.06] text-lg leading-none text-[#c5cdd3] hover:bg-white/[0.08] hover:text-white"
        >
          −
        </div>
        <div
          role="button"
          tabIndex={0}
          data-valbox-action="close"
          aria-label="关闭"
          onClick={() => closeDesktopWindow()}
          className="flex h-10 w-12 cursor-pointer items-center justify-center border-l border-white/[0.06] text-sm text-[#c5cdd3] hover:bg-[#ff4655] hover:text-white"
        >
          ✕
        </div>
      </div>
    </header>
  );
}
