"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientHomeStats } from "@/components/client/ClientHomeStats";
import { CompanionPanel } from "@/components/companion/CompanionPanel";
import { GoodSamaritanPanel } from "@/components/client/GoodSamaritanPanel";
import { ClientShell } from "@/components/client/ClientShell";
import { useClientReady } from "@/components/client/ClientReadyContext";
import { PlayerAvatar } from "@/components/report/PlayerAvatar";
import {
  buildStoredPlayerReport,
  saveStoredPlayerReport,
} from "@/lib/player-report-storage";
import { randomUUID } from "@/lib/random-uuid";

function ClientDashboardContent() {
  const router = useRouter();
  const { me } = useClientReady();
  const [openingMine, setOpeningMine] = useState(false);

  const openMyReport = async () => {
    if (!me?.display_name) return;
    setOpeningMine(true);
    try {
      const res = await fetch(
        `/api/player?q=${encodeURIComponent(me.display_name)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error || "查询失败"));
      const reportId = randomUUID();
      saveStoredPlayerReport(
        reportId,
        buildStoredPlayerReport(data, me.display_name),
      );
      router.push(
        `/local/${reportId}?q=${encodeURIComponent(me.display_name)}`,
      );
    } catch {
      router.push(`/search?q=${encodeURIComponent(me.display_name)}`);
    } finally {
      setOpeningMine(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
          我的
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">本机账号与连接</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
        <section className="val-cut-panel flex flex-col border border-white/10 bg-[#1a242e]/90 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6d7a82]">
            我的账号
          </p>

          {me?.display_name ? (
            <div className="mt-5 flex flex-1 flex-col">
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  src={me.player_card_icon}
                  name={me.display_name}
                  size={52}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="truncate text-2xl font-bold text-white">
                      {me.game_name}
                      <span className="text-[#ffb84d]">#{me.tag_line}</span>
                    </p>
                    {me.account_level ? (
                      <span className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-[#c5cdd3]">
                        Lv.{me.account_level}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <ClientHomeStats
                displayName={me.display_name}
                subject={me.subject}
              />
              <button
                type="button"
                onClick={() => void openMyReport()}
                disabled={openingMine}
                className="mt-auto w-full bg-[#ff4655] py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#ff5563] disabled:opacity-50"
              >
                {openingMine ? "加载中…" : "查看我的战绩"}
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-1 flex-col justify-center">
              <p className="text-sm font-medium text-[#c5cdd3]">
                {me?.message || "正在识别账号…"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#6d7a82]">
                Token 已就绪，查战绩与对局认人可用；识别到 ID 后可一键查看我的战绩。
              </p>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <div className="val-cut-panel border border-white/10 bg-[#1a242e]/90 p-2">
            <CompanionPanel embedded />
          </div>
          <GoodSamaritanPanel embedded />
        </section>
      </div>
    </div>
  );
}

export function ClientDashboard() {
  return (
    <ClientShell scrollable>
      <ClientDashboardContent />
    </ClientShell>
  );
}
