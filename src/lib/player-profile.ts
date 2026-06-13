import { getPlayerCardDisplay, getSeasonDisplay } from "./game-assets";
import { getRankName } from "./constants";
import { getSessionSubject } from "./riot-account";
import { getCompanionFileSession, getRiotSession } from "./riot-session";

const PENALTY_TYPE_LABELS: Record<string, string> = {
  PERMANENT_BAN: "永久封禁",
  TIME_BAN: "限时封禁",
  PERMA_BAN: "永久封禁",
  RANKED_RESTRICTION: "竞技模式限制",
  RANKED_RESTRICTED: "竞技模式限制",
  CHAT_RESTRICTION: "聊天限制",
  CHAT_RESTRICTED: "聊天限制",
  ACCOUNT_RESTRICTION: "账号限制",
  MATCHMAKING_RESTRICTED: "匹配限制",
  QUEUE_RESTRICTED: "队列限制",
};

function penaltyExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime();
  return Number.isFinite(ms) && ms > 0 && Date.now() > ms;
}

function mapPenaltyType(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const mapped = PENALTY_TYPE_LABELS[value.toUpperCase()] || value;
  if (mapped === "限制" || mapped.toLowerCase() === "restriction") return null;
  return mapped;
}

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

export function parsePenalties(raw: unknown, queriedSubject: string): PenaltySummary {
  const data = raw as {
    Subject?: string;
    Penalties?: Array<Record<string, unknown>>;
  } | null;

  if (!data) {
    return { has_active: false, items: [] };
  }

  const sessionSubject = String(data.Subject || "").trim();
  const subjectMatches =
    !sessionSubject ||
    !queriedSubject ||
    sessionSubject.toLowerCase() === queriedSubject.toLowerCase();

  if (!subjectMatches) {
    return {
      has_active: false,
      items: [],
      note: "处罚接口仅返回登录账号本人状态，查他人时不展示",
    };
  }

  const penalties = Array.isArray(data.Penalties) ? data.Penalties : [];
  const items = penalties
    .map((p) => {
      const type =
        mapPenaltyType(p.Type || p.type || p.CheeseType || p.RestrictionType) ||
        mapPenaltyType(p.Name);
      const reason = String(p.Reason || p.reason || p.Message || "").trim();
      const expires_at = String(
        p.ExpirationDate || p.expirationDate || p.EndTime || "",
      );
      return { type: type || reason || "", reason, expires_at };
    })
    .filter((p) => p.type && !penaltyExpired(p.expires_at));

  return {
    has_active: items.length > 0,
    items,
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
  const session = getCompanionFileSession() || (await getRiotSession());
  const sessionSubject = getSessionSubject(session);

  if (
    sessionSubject &&
    queriedSubject &&
    sessionSubject.toLowerCase() !== queriedSubject.toLowerCase()
  ) {
    return { has_active: false, items: [] };
  }

  const { fetchPenalties } = await import("./riot");
  const raw = await fetchPenalties();
  return parsePenalties(raw, queriedSubject);
}
