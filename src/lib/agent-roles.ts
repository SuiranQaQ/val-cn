/** 特工职能（valorant-api role） */

export type AgentRole = "duelist" | "initiator" | "controller" | "sentinel";

export const AGENT_ROLE_ORDER: AgentRole[] = [
  "duelist",
  "initiator",
  "controller",
  "sentinel",
];

export const AGENT_ROLE_LABEL: Record<AgentRole, string> = {
  duelist: "决斗",
  initiator: "先锋",
  controller: "控场",
  sentinel: "哨位",
};

export const AGENT_ROLE_SHORT: Record<AgentRole, string> = {
  duelist: "决斗",
  initiator: "先锋",
  controller: "控场",
  sentinel: "哨位",
};

/** 从 valorant-api role.displayName 归一化（支持中英文） */
export function normalizeAgentRole(displayName: string): AgentRole | null {
  const n = displayName.trim().toLowerCase();
  if (!n) return null;
  if (n.includes("duelist") || n.includes("决斗")) return "duelist";
  if (n.includes("initiator") || n.includes("先锋")) return "initiator";
  if (n.includes("controller") || n.includes("控场")) return "controller";
  if (n.includes("sentinel") || n.includes("哨")) return "sentinel";
  return null;
}

export function emptyRoleCounts(): Record<AgentRole, number> {
  return { duelist: 0, initiator: 0, controller: 0, sentinel: 0 };
}
