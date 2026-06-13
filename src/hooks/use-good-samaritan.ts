"use client";

import { useCallback, useEffect, useState } from "react";
import { isClientApp } from "@/lib/app-mode";

export const GOOD_SAMARITAN_STORAGE_KEY = "valcn_good_samaritan";

function describeShareError(data: Record<string, unknown>): string {
  const code = String(data.error || "");
  const upstream = (data.upstream || {}) as Record<string, unknown>;
  const upstreamCode = String(upstream.error || "");

  if (code === "need_own_token") {
    return "需先由 Companion 捕获本机 Token";
  }
  if (code === "share_failed") {
    return `网络错误：${String(data.message || "无法连接官网")}`;
  }
  if (upstreamCode === "contribute_unauthorized") {
    return "提交失败：未配置 SESSION_POOL_CONTRIBUTE_SECRET";
  }
  if (upstreamCode === "contribute_disabled") {
    return "提交失败：官网已关闭公用池接收";
  }
  if (upstreamCode === "website_only") {
    return "提交失败：目标地址不是官网（请更新客户端配置）";
  }
  if (upstreamCode === "pool_encryption_key_missing") {
    return "提交失败：官网 Token 池未正确配置";
  }
  if (upstreamCode === "pool_encryption_required_on_website") {
    return "提交失败：官网未配置 SESSION_POOL_ENCRYPTION_KEY（需在服务器设置）";
  }
  if (upstreamCode && upstreamCode !== "upstream_failed") {
    return `提交失败：${upstreamCode}`;
  }
  if (data.target) {
    return `提交失败（${String(data.target)}）`;
  }
  return "提交失败";
}

export function useGoodSamaritan() {
  const [enabled, setEnabledState] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState("");
  const [statusOk, setStatusOk] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isClientApp()) return;
    const stored = localStorage.getItem(GOOD_SAMARITAN_STORAGE_KEY);
    const on = stored !== "0";
    if (stored === null) {
      localStorage.setItem(GOOD_SAMARITAN_STORAGE_KEY, "1");
    }
    setEnabledState(on);
    setInitialized(true);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    localStorage.setItem(GOOD_SAMARITAN_STORAGE_KEY, next ? "1" : "0");
  }, []);

  const shareNow = useCallback(async () => {
    if (!isClientApp()) return;
    setSharing(true);
    setStatus("");
    try {
      const res = await fetch("/api/session/share", { method: "POST" });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        if (data.error === "no_local_session") {
          setStatus("");
          setStatusOk(true);
        } else {
          setStatus(describeShareError(data));
          setStatusOk(false);
        }
        return;
      }
      setStatusOk(true);
      setStatus(`已贡献到公用池（${data.pool_total ?? "?"} 条）`);
    } catch {
      setStatusOk(false);
      setStatus("网络错误");
    } finally {
      setSharing(false);
    }
  }, []);

  useEffect(() => {
    if (!isClientApp() || !initialized || !enabled) return;

    void shareNow();
    const t = setInterval(() => void shareNow(), 10 * 60_000);
    return () => clearInterval(t);
  }, [enabled, initialized, shareNow]);

  return {
    enabled,
    setEnabled,
    status,
    statusOk,
    sharing,
    shareNow,
    initialized,
  };
}
