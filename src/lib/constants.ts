export const RANK_TIERS: Record<number, string> = {
  0: "未定级",
  3: "黑铁 I", 4: "黑铁 II", 5: "黑铁 III",
  6: "青铜 I", 7: "青铜 II", 8: "青铜 III",
  9: "白银 I", 10: "白银 II", 11: "白银 III",
  12: "黄金 I", 13: "黄金 II", 14: "黄金 III",
  15: "铂金 I", 16: "铂金 II", 17: "铂金 III",
  18: "钻石 I", 19: "钻石 II", 20: "钻石 III",
  21: "超凡 I", 22: "超凡 II", 23: "超凡 III",
  24: "神话", 25: "辐能",
};

export const MAP_NAMES: Record<string, string> = {
  "/Game/Maps/Ascent/Ascent": "亚海悬城",
  "/Game/Maps/Bonsai/Bonsai": "霓虹町",
  "/Game/Maps/Duality/Duality": "源工重镇",
  "/Game/Maps/Foxtrot/Foxtrot": "微风岛屿",
  "/Game/Maps/Port/Port": "森寒冬港",
  "/Game/Maps/Triad/Triad": "莲华古城",
  "/Game/Maps/Pitt/Pitt": "裂变峡谷",
  "/Game/Maps/Jam/Jam": "日落之城",
  "/Game/Maps/Juliett/Juliett": "盐海矿镇",
  "/Game/Maps/Canyon/Canyon": "幽邃地窟",
};

export const AGENT_NAMES: Record<string, string> = {
  "601dbbe7-43ce-be57-2a40-4abd2495a02b": "K/O",
  "22697a3d-45bf-8dd7-4fec-84a9e28c69da": "Chamber",
  "1e58d9c7-49e9-54d9-b68f-3849b8af1d39": "Killjoy",
  "95b78ed7-463b-56d9-8bc6-59b9d4adb66c": "Harbor",
  "5f8d3a7f-467b-97f3-062c-13acf203c006": "Breach",
  "9f0d8ba9-4140-b941-57d3-a7ad57c6b417": "Brimstone",
  "bb2a4828-46eb-8cd1-e765-15848195d751": "Neon",
  "cc8b64c8-4b25-4ff9-6e7f-37b4da43d531": "Deadlock",
  "e370fa57-4757-3604-3648-499e1f642d3f": "Gekko",
  "320b2a48-4d9b-a075-30f1-1f93a9b638fa": "Sova",
  "6fdf90e1-4581-45d3-7fa2-0a6b47f1b07b": "Phoenix",
  "41fb69c1-4189-7b37-f117-badc59a06a4b": "Reyna",
  "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc": "Reyna",
  "add6443a-41bd-e414-f6ad-58bdfa5a7b2a": "Jett",
  "707eab51-4836-f488-046a-cda6bf494859": "Viper",
  "569fdd95-4d10-43ab-ca70-79becc718b46": "Sage",
  "117ed9e3-49f3-6512-3ccf-0cada7e3823b": "Cypher",
  "1dbf2edd-4729-0984-3115-daa5eed44993": "Clove",
  "eb93336a-449b-9c1b-0a54-a891f7921d69": "Phoenix",
  "a71e3cce-4720-5643-99fb-59c4a7b24e57": "Iso",
  "dade69b4-4f5a-8528-247b-2e5d1bb2176d": "Fade",
  "f94c3b6a-4c60-95cc-549b-63d2922d6f0f": "Yoru",
  "15e3841c-4867-9606-3e9c-757577d58a46": "Skye",
};

export const QUEUE_NAMES: Record<string, string> = {
  competitive: "竞技",
  unrated: "普通",
  swiftplay: "极速",
  deathmatch: "死斗",
  spikerush: "尖锋",
  ggteam: "团队乱斗",
  newmap: "新地图",
  custom: "自定义",
};

export function getMapName(mapId: string): string {
  const normalized = mapId.replace(/\\/g, "/").replace(/\/+$/, "");
  if (MAP_NAMES[normalized]) return MAP_NAMES[normalized];
  const lower = normalized.toLowerCase();
  for (const [key, name] of Object.entries(MAP_NAMES)) {
    if (key.toLowerCase() === lower) return name;
  }
  return normalized.split("/").pop() || "未知地图";
}

export function getAgentName(agentId: string): string {
  return AGENT_NAMES[agentId] || agentId.slice(0, 8);
}

export function getRankName(tier: number): string {
  return RANK_TIERS[tier] || (tier > 0 ? `Tier ${tier}` : "未定级");
}
