import { NextResponse } from "next/server";
import { fetchLivePartyStatus } from "@/lib/live-party";
import { getRiotSession } from "@/lib/riot-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRiotSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "session_unavailable" },
      { status: 503 },
    );
  }

  const party = await fetchLivePartyStatus();
  return NextResponse.json({ ok: !!party, party });
}
