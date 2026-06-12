export interface StoredPlayerReport {
  subject: string;
  player_name: string;
  rank_info: string;
  rank_rr?: number;
  season_id?: string;
  season_name?: string;
  account_level?: number;
  player_card_icon?: string;
  player_card_wide?: string;
  penalties?: {
    has_active: boolean;
    items: Array<{ type: string; reason: string; expires_at: string }>;
    note?: string;
  };
  match_ids: string[];
  match_history_total: number;
  rank_trend: Array<{
    label: string;
    tier: number;
    rr: number;
    changed: number;
  }>;
  updates?: Record<string, unknown> | null;
}

export function buildStoredPlayerReport(
  data: Record<string, unknown>,
  playerName: string,
): StoredPlayerReport {
  return {
    subject: String(data.subject || ""),
    player_name: playerName,
    rank_info: String(data.rank_info || "未定级"),
    rank_rr: data.rank_rr as number | undefined,
    season_id: data.season_id as string | undefined,
    season_name: data.season_name as string | undefined,
    account_level: data.account_level as number | undefined,
    player_card_icon: data.player_card_icon as string | undefined,
    player_card_wide: data.player_card_wide as string | undefined,
    penalties: data.penalties as StoredPlayerReport["penalties"],
    match_ids: (data.match_ids as string[]) || [],
    match_history_total: Number(data.match_history_total || 0),
    rank_trend:
      (data.rank_trend as StoredPlayerReport["rank_trend"]) || [],
    updates: (data.updates as Record<string, unknown> | null) || null,
  };
}

export function saveStoredPlayerReport(
  reportId: string,
  report: StoredPlayerReport,
): void {
  sessionStorage.setItem(
    `player_report_${reportId}`,
    JSON.stringify(report),
  );
}

export function buildSharePlayerUrl(playerName: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?q=${encodeURIComponent(playerName)}`;
}
