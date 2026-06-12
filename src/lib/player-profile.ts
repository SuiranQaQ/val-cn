import { getPlayerCardDisplay, getSeasonDisplay } from "./game-assets";
import { getRankName } from "./constants";

export interface PlayerProfileMeta {
  season_id: string;
  season_name: string;
  rank_info: string;
  rank_tier: number;
  rank_rr: number;
  account_level: number;
  player_card_id: string;
  player_card_icon: string;
  player_card_wide: string;
}

export interface PenaltySummary {
  has_active: boolean;
  items: Array<{
    type: string;
    reason: string;
    expires_at: string;
  }>;
  note?: string;
}

function parsePenalties(raw: unknown, queriedSubject: string): PenaltySummary {
  const data = raw as {
    Subject?: string;
    Penalties?: Array<Record<string, unknown>>;
  } | null;

  if (!data) {
    return {
      has_active: false,
      items: [],
      note: "无法获取处罚记录（需有效 Riot 会话）",
    };
  }

  const sessionSubject = String(data.Subject || "");
  const penalties = Array.isArray(data.Penalties) ? data.Penalties : [];
  const items = penalties
    .map((p) => ({
      type: String(p.Type || p.type || p.CheeseType || "限制"),
      reason: String(p.Reason || p.reason || p.Message || "未知原因"),
      expires_at: String(
        p.ExpirationDate || p.expirationDate || p.EndTime || "",
      ),
    }))
    .filter((p) => p.type || p.reason);

  let note: string | undefined;
  if (
    sessionSubject &&
    queriedSubject &&
    sessionSubject.toLowerCase() !== queriedSubject.toLowerCase()
  ) {
    note = "当前会话非被查询玩家本人，此处显示的是会话账号的处罚状态";
  }

  return {
    has_active: items.length > 0,
    items,
    note,
  };
}

export async function buildProfileFromUpdates(
  updates: Record<string, unknown> | null,
): Promise<Partial<PlayerProfileMeta>> {
  const latest = (updates?.Matches as Array<Record<string, unknown>>)?.[0];
  if (!latest) return {};

  const seasonId = String(latest.SeasonID || "");
  const season = seasonId ? await getSeasonDisplay(seasonId) : null;
  const tier = Number(latest.TierAfterUpdate || 0);

  return {
    season_id: seasonId,
    season_name: season?.name || "",
    rank_info: getRankName(tier),
    rank_tier: tier,
    rank_rr: Number(latest.RankedRatingAfterUpdate || 0),
  };
}

export async function enrichWithLoadout(
  subject: string,
  base: Partial<PlayerProfileMeta>,
): Promise<Partial<PlayerProfileMeta>> {
  const { fetchPlayerLoadout, fetchAccountXp } = await import("./riot");

  const [loadout, xp] = await Promise.all([
    fetchPlayerLoadout(subject),
    fetchAccountXp(subject),
  ]);

  const cardId = String(
    (loadout as { Identity?: { PlayerCardID?: string } })?.Identity
      ?.PlayerCardID || "",
  );
  const card = cardId ? await getPlayerCardDisplay(cardId) : null;

  const level = Number(
    (xp as { Progress?: { Level?: number } })?.Progress?.Level ||
      (loadout as { Identity?: { AccountLevel?: number } })?.Identity
        ?.AccountLevel ||
      0,
  );

  return {
    ...base,
    account_level: level || base.account_level || 0,
    player_card_id: cardId || base.player_card_id || "",
    player_card_icon: card?.smallArt || base.player_card_icon || "",
    player_card_wide: card?.wideArt || base.player_card_wide || "",
  };
}

export async function fetchPenaltySummary(
  queriedSubject: string,
): Promise<PenaltySummary> {
  const { fetchPenalties } = await import("./riot");
  const raw = await fetchPenalties();
  return parsePenalties(raw, queriedSubject);
}
