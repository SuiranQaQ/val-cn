export interface LockfileInfo {
  port: string;
  password: string;
}

export interface LockfileProbe {
  lock: LockfileInfo | null;
  path: string | null;
  candidates: string[];
}

/** 国服/国际服常见 lockfile 位置（仅客户端进程在跑时才会生成该文件） */
export function getLockfileCandidatePaths(): string[] {
  const path = require("path") as typeof import("path");
  const local = process.env.LOCALAPPDATA || "";
  const programData = process.env.ProgramData || "";

  return [
    process.env.RIOT_LOCKFILE_PATH,
    path.join(local, "Riot Games", "Riot Client", "Config", "lockfile"),
    path.join(local, "RiotGames", "Riot Client", "Config", "lockfile"),
    path.join(local, "Tencent", "VALORANT", "Riot Client", "Config", "lockfile"),
    path.join(local, "Tencent", "Riot Games", "Riot Client", "Config", "lockfile"),
    path.join(local, "VALORANT", "Riot Client", "Config", "lockfile"),
    path.join(local, "VALORANT", "Config", "lockfile"),
    path.join(programData, "Riot Games", "Riot Client", "Config", "lockfile"),
  ].filter(Boolean) as string[];
}

/** 读取 Riot Client lockfile（客户端运行时） */
export async function readLockfile(): Promise<LockfileInfo | null> {
  const probe = await probeLockfile();
  return probe.lock;
}

export async function probeLockfile(): Promise<LockfileProbe> {
  if (process.platform !== "win32") {
    return { lock: null, path: null, candidates: [] };
  }

  const fs = await import("fs/promises");
  const candidates = getLockfileCandidatePaths();

  for (const filePath of candidates) {
    try {
      const content = (await fs.readFile(filePath, "utf8")).trim();
      const parts = content.split(":");
      if (parts.length < 5) continue;
      const port = parts[2];
      const password = parts[3];
      if (port && password) {
        return { lock: { port, password }, path: filePath, candidates };
      }
    } catch {
      // try next
    }
  }

  return { lock: null, path: null, candidates };
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
