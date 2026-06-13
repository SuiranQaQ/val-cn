/**
 * 游戏资源来自 valorant-api.com（社区维护的官方数据镜像）
 * 与 valcn 等站点相同思路：配图用公开资源 API，战绩用 Riot 接口
 */

import {
  normalizeAgentRole,
  type AgentRole,
} from "./agent-roles";

interface AgentAsset {
  uuid: string;
  displayName: string;
  displayIcon: string;
  isPlayableCharacter?: boolean;
  role?: { displayName?: string };
}

interface MapAsset {
  uuid: string;
  displayName: string;
  mapUrl: string;
  listViewIcon: string;
  splash: string;
}

interface TierAsset {
  tier: number;
  tierName: string;
  largeIcon: string;
}

interface SeasonAsset {
  uuid: string;
  displayName: string;
  title?: string;
  parentUuid?: string;
  type?: string;
}

interface PlayerCardAsset {
  uuid: string;
  displayName: string;
  smallArt: string;
  wideArt: string;
}

let cache: {
  agentsById: Map<string, AgentAsset>;
  mapsByPath: Map<string, MapAsset>;
  tierIcons: Map<number, string>;
  tierNames: Map<number, string>;
  seasonsById: Map<string, SeasonAsset>;
  cardsById: Map<string, PlayerCardAsset>;
  loadedAt: number;
} | null = null;

function normPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

async function loadCache() {
  if (cache && Date.now() - cache.loadedAt < 60 * 60 * 1000) return cache;

  const [agentsRes, mapsRes, tiersRes, seasonsRes, cardsRes] =
    await Promise.all([
      fetch("https://valorant-api.com/v1/agents?language=zh-CN", {
        next: { revalidate: 86400 },
      }),
      fetch("https://valorant-api.com/v1/maps?language=zh-CN", {
        next: { revalidate: 86400 },
      }),
      fetch("https://valorant-api.com/v1/competitivetiers?language=zh-CN", {
        next: { revalidate: 86400 },
      }),
      fetch("https://valorant-api.com/v1/seasons?language=zh-CN", {
        next: { revalidate: 86400 },
      }),
      fetch("https://valorant-api.com/v1/playercards?language=zh-CN", {
        next: { revalidate: 86400 },
      }),
    ]);

  const agentsJson = await agentsRes.json();
  const mapsJson = await mapsRes.json();
  const tiersJson = await tiersRes.json();
  const seasonsJson = await seasonsRes.json();
  const cardsJson = await cardsRes.json();

  const agentsById = new Map<string, AgentAsset>();
  for (const a of agentsJson?.data || []) {
    if (a?.uuid) agentsById.set(String(a.uuid).toLowerCase(), a);
  }

  const mapsByPath = new Map<string, MapAsset>();
  for (const m of mapsJson?.data || []) {
    if (m?.mapUrl) mapsByPath.set(normPath(m.mapUrl), m);
  }

  const tierIcons = new Map<number, string>();
  const tierNames = new Map<number, string>();
  const acts = tiersJson?.data || [];
  const latestAct = acts[acts.length - 1];
  for (const t of latestAct?.tiers || []) {
    tierIcons.set(Number(t.tier), String(t.largeIcon || ""));
    tierNames.set(Number(t.tier), String(t.tierName || ""));
  }

  const seasonsById = new Map<string, SeasonAsset>();
  for (const s of seasonsJson?.data || []) {
    if (s?.uuid) seasonsById.set(String(s.uuid).toLowerCase(), s);
  }

  const cardsById = new Map<string, PlayerCardAsset>();
  for (const c of cardsJson?.data || []) {
    if (c?.uuid) cardsById.set(String(c.uuid).toLowerCase(), c);
  }

  cache = {
    agentsById,
    mapsByPath,
    tierIcons,
    tierNames,
    seasonsById,
    cardsById,
    loadedAt: Date.now(),
  };
  return cache;
}

export async function getAgentDisplay(
  agentId: string,
): Promise<{ name: string; icon: string } | null> {
  const c = await loadCache();
  const a = c.agentsById.get(agentId.toLowerCase());
  if (!a) return null;
  return { name: a.displayName, icon: a.displayIcon };
}

export async function getMapDisplay(
  mapId: string,
): Promise<{ name: string; listIcon: string; splash: string } | null> {
  const c = await loadCache();
  const m = c.mapsByPath.get(normPath(mapId));
  if (!m) return null;
  return {
    name: m.displayName,
    listIcon: m.listViewIcon,
    splash: m.splash,
  };
}

export async function getRankDisplay(
  tier: number,
): Promise<{ name: string; icon: string } | null> {
  if (!tier) return null;
  const c = await loadCache();
  const icon = c.tierIcons.get(tier);
  const name = c.tierNames.get(tier);
  if (!icon && !name) return null;
  return { name: name || "", icon: icon || "" };
}

export async function getSeasonDisplay(
  seasonId: string,
): Promise<{ name: string; actName: string; episodeName: string } | null> {
  if (!seasonId) return null;
  const c = await loadCache();
  const act = c.seasonsById.get(seasonId.toLowerCase());
  if (!act) return null;

  let episodeName = "";
  if (act.parentUuid) {
    const ep = c.seasonsById.get(act.parentUuid.toLowerCase());
    episodeName = ep?.displayName || "";
  }

  const actName = act.displayName || "";
  const name = episodeName ? `${episodeName} ${actName}` : act.title || actName;
  return { name, actName, episodeName };
}

export async function getPlayableAgents(): Promise<
  Array<{ id: string; name: string; icon: string; role: AgentRole | null }>
> {
  const c = await loadCache();
  const list: Array<{
    id: string;
    name: string;
    icon: string;
    role: AgentRole | null;
  }> = [];
  for (const [, a] of c.agentsById.entries()) {
    if (a.isPlayableCharacter === false) continue;
    if (!a.displayIcon) continue;
    list.push({
      id: a.uuid,
      name: a.displayName,
      icon: a.displayIcon,
      role: normalizeAgentRole(a.role?.displayName || ""),
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function getPlayerCardDisplay(
  cardId: string,
): Promise<{ name: string; smallArt: string; wideArt: string } | null> {
  if (!cardId) return null;
  const c = await loadCache();
  const card = c.cardsById.get(cardId.toLowerCase());
  if (!card) return null;
  return {
    name: card.displayName,
    smallArt: card.smallArt,
    wideArt: card.wideArt,
  };
}
