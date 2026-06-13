"use client";

import { AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import type { BehaviorGuardStatus } from "@/lib/behavior-guard";

export function BehaviorGuardBanner({
  status,
  compact,
}: {
  status: BehaviorGuardStatus;
  compact?: boolean;
}) {
  const Icon =
    status.risk_level === "danger"
      ? ShieldAlert
      : status.risk_level === "warn"
        ? AlertTriangle
        : Shield;

  const border =
    status.risk_level === "danger"
      ? "border-rose-500/40 bg-rose-950/30"
      : status.risk_level === "warn"
        ? "border-amber-500/35 bg-amber-950/25"
        : "border-emerald-500/20 bg-emerald-950/15";

  const title =
    status.risk_level === "danger"
      ? "账号行为限制中"
      : status.risk_level === "warn"
        ? "上局有行为标记 · 注意避免红屏"
        : "行为状态正常";

  const iconColor =
    status.risk_level === "danger"
      ? "text-rose-400"
      : status.risk_level === "warn"
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-left ${border} ${compact ? "text-[10px]" : "text-[11px]"}`}
    >
      <div className="flex items-start gap-2">
        <Icon size={compact ? 14 : 16} className={`mt-0.5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-100">{title}</p>
          <ul className="mt-1 space-y-0.5 text-gray-400">
            {status.risk_lines.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>

          {status.intervention?.me_flagged ? (
            <p className="mt-1.5 text-amber-200/90">
              系统判定：{status.intervention.me_flagged.infraction_labels.join("、")}
            </p>
          ) : null}

          {status.last_match && status.risk_level !== "ok" ? (
            <p className="mt-1 text-gray-500">
              {status.last_match.map_name} · {status.last_match.queue_name} ·{" "}
              {status.last_match.score} · {status.last_match.is_win ? "胜" : "负"}
            </p>
          ) : null}

          {!compact ? (
            <>
              <p className="mt-2 text-[9px] leading-relaxed text-gray-500">
                {status.note_reporter}
              </p>
              <div className="mt-2 space-y-0.5 text-[9px] text-gray-500">
                {status.tips.map((tip) => (
                  <p key={tip}>※ {tip}</p>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
