"use client";

import { useState, type RefObject } from "react";
import { Copy, Star, Check, ImageDown, Loader2 } from "lucide-react";
import { isFavorite, saveFavorite, removeFavorite } from "@/lib/favorites";
import { buildSharePlayerUrl } from "@/lib/player-report-storage";
import { captureElementAsPng } from "@/lib/share-screenshot";

function safeFilename(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fa5#-]+/g, "_").slice(0, 48);
}

export function ReportShareBar({
  playerName,
  subject,
  captureRef,
  onPrepareCapture,
  onFinishCapture,
}: {
  playerName: string;
  subject: string;
  captureRef?: RefObject<HTMLDivElement | null>;
  onPrepareCapture?: () => Promise<void>;
  onFinishCapture?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shotState, setShotState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [shotHint, setShotHint] = useState("");
  const [fav, setFav] = useState(() =>
    typeof window !== "undefined"
      ? isFavorite(subject, playerName)
      : false,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSharePlayerUrl(playerName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleScreenshot = async () => {
    setShotState("loading");
    setShotHint("正在展开报告并生成长图…");

    try {
      await onPrepareCapture?.();
      await new Promise((r) => setTimeout(r, 400));

      const el = captureRef?.current;
      if (!el) throw new Error("screenshot_zero_size");

      const result = await captureElementAsPng(
        el,
        `valcn-${safeFilename(playerName)}.png`,
      );
      setShotState("done");
      setShotHint(
        result.copied
          ? "长图已下载，并已复制到剪贴板"
          : "长图已下载（内容较多时剪贴板可能不支持）",
      );
      setTimeout(() => {
        setShotState("idle");
        setShotHint("");
      }, 3000);
    } catch (err) {
      console.error("capture screenshot", err);
      setShotState("error");
      const code = err instanceof Error ? err.message : "";
      setShotHint(
        code === "screenshot_zero_size"
          ? "报告未加载完，请等待比赛详情出现后再试"
          : code === "screenshot_blank_canvas" ||
              code === "screenshot_blank_tile" ||
              code === "screenshot_empty"
            ? "画布生成失败，请刷新页面后重试"
            : code === "screenshot_canvas_context" || code === "screenshot_no_parent"
              ? "浏览器不支持截图，请换 Chrome/Edge 重试"
              : "长图生成失败，请确认至少有几场已加载的比赛后再试",
      );
      setTimeout(() => {
        setShotState("idle");
        setShotHint("");
      }, 3500);
    } finally {
      onFinishCapture?.();
    }
  };

  const toggleFavorite = () => {
    if (fav) {
      removeFavorite(subject || playerName);
      setFav(false);
    } else {
      saveFavorite({
        player_name: playerName,
        subject,
        saved_at: new Date().toISOString(),
      });
      setFav(true);
    }
  };

  return (
    <div className="space-y-1.5" data-capture-exclude="true">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleScreenshot}
          disabled={shotState === "loading"}
          className="inline-flex items-center gap-1 rounded-full border border-[#ff4655]/30 bg-[#ff4655]/10 px-2.5 py-1 text-[10px] text-rose-200 transition hover:bg-[#ff4655]/20 disabled:opacity-60"
        >
          {shotState === "loading" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : shotState === "done" ? (
            <Check size={12} />
          ) : (
            <ImageDown size={12} />
          )}
          {shotState === "loading"
            ? "生成长图中…"
            : shotState === "done"
              ? "已生成"
              : "生成长图"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300 transition hover:bg-white/10"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "已复制链接" : "复制分享链接"}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition ${
            fav
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          <Star size={12} className={fav ? "fill-amber-400" : ""} />
          {fav ? "已收藏" : "收藏玩家"}
        </button>
      </div>
      {shotHint ? (
        <p
          className={`text-[10px] ${
            shotState === "error" ? "text-amber-400" : "text-gray-500"
          }`}
        >
          {shotHint}
        </p>
      ) : null}
    </div>
  );
}
