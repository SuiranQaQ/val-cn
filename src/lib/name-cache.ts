import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || process.env.HOME || "",
  "VAL-CN",
);
const CACHE_FILE = path.join(CACHE_DIR, "name-cache.json");

type NameCacheEntry = {
  subject: string;
  updated_at: string;
};

type NameCacheFile = Record<string, NameCacheEntry>;

async function readCache(): Promise<NameCacheFile> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as NameCacheFile;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export async function getCachedSubject(
  normalizedNameTag: string,
): Promise<string | null> {
  const key = normalizedNameTag.trim().toLowerCase();
  if (!key) return null;
  const cache = await readCache();
  const entry = cache[key];
  const subject = String(entry?.subject || "").trim();
  return subject || null;
}

export async function setCachedSubject(
  normalizedNameTag: string,
  subject: string,
): Promise<void> {
  const key = normalizedNameTag.trim().toLowerCase();
  const id = subject.trim();
  if (!key || !id) return;

  const cache = await readCache();
  cache[key] = { subject: id, updated_at: new Date().toISOString() };

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // 缓存写入失败不影响主流程
  }
}
