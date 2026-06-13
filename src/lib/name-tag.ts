/** 客户端可用的 Name#Tag 工具（不依赖 Node fs） */

export function normalizeNameTag(nameTag: string): string {
  return nameTag
    .trim()
    .replace(/\uFF03/g, "#")
    .replace(/\s+#\s+/, "#");
}

export function splitNameTag(
  nameTag: string,
): { gameName: string; tagLine: string } | null {
  const trimmed = normalizeNameTag(nameTag);
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim(),
  };
}
