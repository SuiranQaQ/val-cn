import { NextRequest, NextResponse } from "next/server";
import { fetchBehaviorGuardStatus } from "@/lib/behavior-guard";
import { getSessionSubject } from "@/lib/riot-account";
import { getRiotSession } from "@/lib/riot-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getRiotSession();
  const subject = getSessionSubject(session);
  if (!subject) {
    return NextResponse.json(
      { ok: false, error: "session_unavailable" },
      { status: 503 },
    );
  }

  const matchId = request.nextUrl.searchParams.get("match_id")?.trim() || "";

  try {
    const status = await fetchBehaviorGuardStatus({
      mySubject: subject,
      matchId: matchId || undefined,
    });
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "behavior_status_failed",
      },
      { status: 502 },
    );
  }
}
