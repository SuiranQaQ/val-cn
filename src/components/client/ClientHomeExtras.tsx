"use client";

import { CompanionPanel } from "@/components/companion/CompanionPanel";
import { GoodSamaritanPanel } from "@/components/client/GoodSamaritanPanel";

/** 仅客户端首页需要的面板，动态加载以免打进官网包 */
export function ClientHomeExtras() {
  return (
    <>
      <CompanionPanel />
      <GoodSamaritanPanel />
    </>
  );
}
