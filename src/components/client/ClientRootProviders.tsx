"use client";

import type { ReactNode } from "react";
import { isClientApp } from "@/lib/app-mode";
import { ClientReadyProvider } from "@/components/client/ClientReadyContext";
import { GoodSamaritanProvider } from "@/components/client/GoodSamaritanContext";

/** 客户端全局 Provider（跨页面切换不重置，避免等待页闪烁） */
export function ClientRootProviders({ children }: { children: ReactNode }) {
  if (!isClientApp()) return <>{children}</>;

  return (
    <ClientReadyProvider>
      <GoodSamaritanProvider>{children}</GoodSamaritanProvider>
    </ClientReadyProvider>
  );
}
