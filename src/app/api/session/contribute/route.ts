import { NextRequest, NextResponse } from "next/server";
import { isPoolContributeEnabled, isWebsiteApp } from "@/lib/app-mode";
import { contributeSession, getPoolStats } from "@/lib/session-pool";
import { assertPoolContributeAuth } from "@/lib/session-pool-crypto";

export const dynamic = "force-dynamic";

/** 老好人模式：客户端提交 JWT 到网站公用池（仅官网实例接收） */
export async function POST(request: NextRequest) {
  if (!isWebsiteApp()) {
    return NextResponse.json({ error: "website_only" }, { status: 403 });
  }
  if (!isPoolContributeEnabled()) {
    return NextResponse.json({ error: "contribute_disabled" }, { status: 403 });
  }

  const contributeKey = request.headers.get("x-pool-contribute-key");
  if (!assertPoolContributeAuth(contributeKey)) {
    return NextResponse.json({ error: "contribute_unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const entry = contributeSession({
      access_token: String(body.access_token || body.accessToken || ""),
      entitlements_jwt: String(
        body.entitlements_jwt || body.entitlementsJwt || body.token || "",
      ),
      client_version: String(body.client_version || body.clientVersion || ""),
      client_platform: String(body.client_platform || body.clientPlatform || ""),
      contributor_id: String(body.contributor_id || body.contributorId || ""),
    });

    const stats = getPoolStats();
    return NextResponse.json({
      ok: true,
      contributed_at: entry.contributed_at,
      pool_total: stats.total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "contribute_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
