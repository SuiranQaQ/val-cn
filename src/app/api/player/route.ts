import { NextRequest, NextResponse } from "next/server";
import { fetchPlayerOverview } from "@/lib/riot";
import { buildRankTrend } from "@/lib/stats";
import {
  buildProfileFromUpdates,
  enrichWithLoadout,
  fetchPenaltySummary,
} from "@/lib/player-profile";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("q") || "";
  const trimmed = input.trim();

  if (!trimmed) {
    return NextResponse.json({ error: "missing_player" }, { status: 400 });
  }

  try {
    const overview = await fetchPlayerOverview(trimmed);
    const subject = overview.subject;
    const updates = overview.updates as Record<string, unknown> | null;

    const profileBase = await buildProfileFromUpdates(updates);
    const profile = await enrichWithLoadout(subject, profileBase);
    const penalties = await fetchPenaltySummary(subject);

    return NextResponse.json({
      subject,
      player_name: trimmed.includes("#") ? trimmed : subject,
      match_ids: overview.match_ids,
      match_history_total: overview.match_history_total,
      rank_info: profile.rank_info || "未定级",
      rank_tier: profile.rank_tier || 0,
      rank_rr: profile.rank_rr || 0,
      season_id: profile.season_id || "",
      season_name: profile.season_name || "",
      account_level: profile.account_level || 0,
      player_card_id: profile.player_card_id || "",
      player_card_icon: profile.player_card_icon || "",
      player_card_wide: profile.player_card_wide || "",
      penalties,
      rank_trend: buildRankTrend(updates),
      updates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "request_failed";
    const { getLastNameResolveDetail, getLastNameResolveSource } =
      await import("@/lib/name-resolve");
    return NextResponse.json(
      {
        error: message,
        resolve_source: getLastNameResolveSource(),
        resolve_detail: getLastNameResolveDetail(),
      },
      { status: 502 },
    );
  }
}
