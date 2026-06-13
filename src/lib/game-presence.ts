import { spawnSync } from "child_process";
import { probeLockfile } from "./riot-lockfile";

/** 瓦罗兰特对局进程（国服 ACLOS 同样使用此进程名） */
const GAME_EXE = "valorant-win64-shipping.exe";

const PRESENCE_OK_TTL_MS = 15_000;
const PRESENCE_FAIL_TTL_MS = 4_000;

let presenceCache: { at: number; active: boolean } | null = null;

/** 检测瓦罗兰特是否正在运行（Windows，仅对局进程） */
export function isGameProcessRunning(): boolean {
  if (process.platform !== "win32") return false;

  try {
    const out = spawnSync("tasklist", ["/FO", "CSV", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return out.stdout.toLowerCase().includes(GAME_EXE);
  } catch {
    return false;
  }
}

/**
 * 客户端是否在线：对局进程 或 Riot Client lockfile。
 * 国服大厅有时 tasklist 漏检，lockfile 更稳。
 */
export async function probeGameClientActive(): Promise<boolean> {
  if (presenceCache) {
    const ttl = presenceCache.active ? PRESENCE_OK_TTL_MS : PRESENCE_FAIL_TTL_MS;
    if (Date.now() - presenceCache.at < ttl) {
      return presenceCache.active;
    }
  }

  let active = isGameProcessRunning();
  if (!active && process.platform === "win32") {
    const lockProbe = await probeLockfile();
    active = lockProbe.lock !== null;
  }

  presenceCache = { at: Date.now(), active };
  return active;
}

export function clearGamePresenceCache() {
  presenceCache = null;
}
