import { NextResponse } from "next/server";
import {
  getPoolContributeSiteUrl,
  isClientApp,
} from "@/lib/app-mode";
import {
  getCompanionFileSession,
  getRiotSession,
  getSessionSource,
} from "@/lib/riot-session";
import { getPoolContributeSecret } from "@/lib/session-pool-crypto";

export const dynamic = "force-dynamic";

/** 客户端：读取本机 JWT 并提交到网站公用池（老好人模式） */
export async function POST() {
  if (!isClientApp()) {
    return NextResponse.json({ error: "client_only" }, { status: 403 });
  }

  const fileSession = getCompanionFileSession();
  const session = fileSession || (await getRiotSession());
  const source = fileSession ? "file" : getSessionSource();

  if (!session) {
    return NextResponse.json({ error: "no_local_session" }, { status: 503 });
  }

  if (source !== "file" && source !== "lockfile" && source !== "env") {
    return NextResponse.json(
      { error: "need_own_token", detail: "需 Companion 捕获的本机 Token" },
      { status: 400 },
    );
  }

  const site = getPoolContributeSiteUrl();
  const target = `${site}/api/session/contribute`;

  const access = session.authorization.replace(/^Bearer\s+/i, "");
  const contributeSecret = getPoolContributeSecret();
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(contributeSecret
          ? { "X-Pool-Contribute-Key": contributeSecret }
          : {}),
      },
      body: JSON.stringify({
        access_token: access,
        entitlements_jwt: session.entitlements_jwt,
        client_version: session.client_version,
        client_platform: session.client_platform,
        contributor_id: "val-cn-client",
      }),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "upstream_failed",
          upstream: data,
          status: res.status,
          target,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      shared_to: site,
      contributed_at: data.contributed_at,
      pool_total: data.pool_total,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "share_failed",
        message: err instanceof Error ? err.message : "network_error",
        target,
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    enabled: isClientApp(),
    site_url: getPoolContributeSiteUrl(),
  });
}
