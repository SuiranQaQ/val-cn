import { QUEUE_NAMES } from "./constants";

/** 对局模式显示名 */
export function getQueueDisplayName(mode: string): string {
  const raw = mode.trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (QUEUE_NAMES[lower]) return QUEUE_NAMES[lower];
  for (const [key, label] of Object.entries(QUEUE_NAMES)) {
    if (lower.includes(key)) return label;
  }
  if (lower.includes("swift")) return "极速";
  if (lower.includes("competitive")) return "竞技";
  if (lower.includes("unrated")) return "普通";
  return raw.split("/").pop()?.replace(/_/g, " ") || raw;
}
