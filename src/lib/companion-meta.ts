import fs from "fs";
import net from "net";
import path from "path";
import { probeGameClientActive } from "./game-presence";
import { isJwtExpired, jwtExpiresAtMs } from "./jwt-utils";
import { getSessionFilePathForDiagnostics } from "./riot-session";
import { probeSessionWorks } from "./session-probe";

export interface CompanionMeta {
  session_file: string;
  session_file_exists: boolean;
  updated_at: string | null;
  age_minutes: number | null;
  token_stale: boolean;
  /** JWT exp 字段已过期 */
  jwt_claim_expired: boolean;
  /** 实测 API 不可用（比 exp 更准） */
  jwt_expired: boolean;
  session_works: boolean;
  jwt_expires_in_minutes: number | null;
  game_running: boolean;
  proxy_port: number;
  proxy_running: boolean;
  ca_installed_hint: boolean;
}

const DEFAULT_PROXY_PORT = Number(process.env.VALCN_COMPANION_PORT || 17888);

function probePort(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

/** 读取 Companion session 文件元数据（不返回 Token 内容） */
export async function getCompanionMeta(): Promise<CompanionMeta> {
  const sessionFile = getSessionFilePathForDiagnostics();
  const proxyPort = DEFAULT_PROXY_PORT;

  let session_file_exists = false;
  let updated_at: string | null = null;
  let age_minutes: number | null = null;
  let token_stale = false;
  let jwt_claim_expired = false;
  let jwt_expired = false;
  let session_works = false;
  let jwt_expires_in_minutes: number | null = null;

  try {
    if (fs.existsSync(sessionFile)) {
      session_file_exists = true;
      const raw = fs.readFileSync(sessionFile, "utf8");
      const data = JSON.parse(raw) as {
        updated_at?: string;
        access_token?: string;
        accessToken?: string;
        authorization?: string;
      };
      const mtime = fs.statSync(sessionFile).mtime;
      updated_at =
        data.updated_at?.trim() ||
        mtime.toISOString();
      const ageMs = Date.now() - new Date(updated_at).getTime();
      age_minutes = Math.max(0, Math.floor(ageMs / 60_000));
      token_stale = ageMs > 55 * 60_000;

      const access =
        data.access_token?.trim() ||
        data.accessToken?.trim() ||
        data.authorization?.trim() ||
        "";
      if (access) {
        jwt_claim_expired = isJwtExpired(access);
        const expMs = jwtExpiresAtMs(access);
        if (expMs) {
          jwt_expires_in_minutes = Math.floor((expMs - Date.now()) / 60_000);
        }
      }
    }
  } catch {
    session_file_exists = false;
  }

  if (session_file_exists) {
    session_works = await probeSessionWorks();
    jwt_expired = !session_works && (jwt_claim_expired || token_stale);
  }

  const proxy_running = await probePort(proxyPort);
  const game_running = await probeGameClientActive();

  const caPath = path.join(path.dirname(sessionFile), "certs", "val-cn-ca.pem");
  const ca_installed_hint = fs.existsSync(caPath);

  return {
    session_file: sessionFile,
    session_file_exists,
    updated_at,
    age_minutes,
    token_stale,
    jwt_claim_expired,
    jwt_expired,
    session_works,
    jwt_expires_in_minutes,
    game_running,
    proxy_port: proxyPort,
    proxy_running,
    ca_installed_hint,
  };
}
