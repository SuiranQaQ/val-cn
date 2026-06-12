export interface LockfileInfo {
  port: string;
  password: string;
}

/** 读取 Riot Client lockfile（客户端运行时） */
export async function readLockfile(): Promise<LockfileInfo | null> {
  if (process.platform !== "win32") return null;

  const fs = await import("fs/promises");
  const path = await import("path");

  const candidates = [
    process.env.RIOT_LOCKFILE_PATH,
    path.join(
      process.env.LOCALAPPDATA || "",
      "Riot Games",
      "Riot Client",
      "Config",
      "lockfile",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "RiotGames",
      "Riot Client",
      "Config",
      "lockfile",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Tencent",
      "VALORANT",
      "Riot Client",
      "Config",
      "lockfile",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Tencent",
      "Riot Games",
      "Riot Client",
      "Config",
      "lockfile",
    ),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      const content = (await fs.readFile(filePath, "utf8")).trim();
      const parts = content.split(":");
      if (parts.length < 5) continue;
      const port = parts[2];
      const password = parts[3];
      if (port && password) return { port, password };
    } catch {
      // try next
    }
  }
  return null;
}

export function lockfileAuth(lock: LockfileInfo): string {
  return `Basic ${Buffer.from(`riot:${lock.password}`).toString("base64")}`;
}

/** 调用本机 Riot Client API（自签证书） */
export async function localRiotFetch(
  lock: LockfileInfo,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    return await fetch(`https://127.0.0.1:${lock.port}${path}`, {
      ...init,
      headers: {
        Authorization: lockfileAuth(lock),
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } finally {
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
  }
}
