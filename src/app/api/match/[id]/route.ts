import { NextRequest, NextResponse } from "next/server";
import { enrichMatches } from "@/lib/match-enrich";
import { fetchMatchDetail } from "@/lib/riot";
import { processMatchDetail } from "@/lib/match-processor";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matchId = String(id || "").trim();
  const subject = request.nextUrl.searchParams.get("subject") || "";

  if (!matchId) {
    return NextResponse.json({ error: "missing_match_id" }, { status: 400 });
  }

  try {
    const raw = await fetchMatchDetail(matchId);
    const processed = processMatchDetail(
      matchId,
      raw as Record<string, unknown>,
      subject,
    );
    const [enriched] = await enrichMatches([processed]);
    return NextResponse.json({ match: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "request_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
