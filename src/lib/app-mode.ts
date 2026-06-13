export type AppMode = "website" | "client";

/** 网站 = 官网/查询/下载；客户端 = 本机成品（对局/伴生/老好人） */
export function getAppMode(): AppMode {
  const v = process.env.NEXT_PUBLIC_APP_MODE?.trim().toLowerCase();
  if (v === "client") return "client";
  return "website";
}

export function isClientApp(): boolean {
  return getAppMode() === "client";
}

export function isWebsiteApp(): boolean {
  return getAppMode() === "website";
}

export function getPublicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "https://valcn.suiran.xyz"
  );
}

/** 老好人贡献目标（始终指向官网，避免 dev 把 SITE_URL 设成 localhost） */
export function getPoolContributeSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_POOL_SITE_URL?.trim() ||
    process.env.SESSION_POOL_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const site = getPublicSiteUrl().replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(site)) {
    return "https://valcn.suiran.xyz";
  }
  return site;
}

export function isPoolContributeEnabled(): boolean {
  const v = process.env.SESSION_POOL_CONTRIBUTE?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}
