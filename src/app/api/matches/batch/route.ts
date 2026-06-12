import { NextRequest, NextResponse } from "next/server";
import { enrichMatches } from "@/lib/match-enrich";
import { fetchMatchDetail } from "@/lib/riot";
import { processMatchDetail, type ProcessedMatch } from "@/lib/match-processor";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const matchIds = Array.isArray(body.matchIds) ? body.matchIds : [];
  const subject = String(body.subject || "").trim();

  if (!matchIds.length) {
    return NextResponse.json({ error: "missing_match_ids" }, { status: 400 });
  }

  const ids = matchIds
    .map((id: unknown) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 20);

  const rawResults: Record<string, ProcessedMatch> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    ids.map(async (matchId: string) => {
      try {
        const raw = await fetchMatchDetail(matchId);
        rawResults[matchId] = processMatchDetail(
          matchId,
          raw as Record<string, unknown>,
          subject,
        );
      } catch (err) {
        errors[matchId] =
          err instanceof Error ? err.message : "request_failed";
      }
    }),
  );

  const list = ids
    .map((id: string) => rawResults[id])
    .filter(Boolean) as ProcessedMatch[];

  const enriched = await enrichMatches(list);
  const results: Record<string, ProcessedMatch> = {};
  for (const m of enriched) {
    if (m.match_id) results[m.match_id] = m;
  }

  return NextResponse.json({ matches: results, errors });
}
