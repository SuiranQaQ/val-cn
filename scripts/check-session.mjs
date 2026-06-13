/**
 * 本机会话检查（无需启动 Next.js）
 * 用法: node scripts/check-session.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_CLIENT_VERSION = "release-china-12.11-shipping-12-4815700";
const VALCN_BASE = "https://valcn.top";

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function mergeEnv() {
  const files = [".env.local", ".env"];
  const merged = { ...process.env };
  for (const name of files) {
    Object.assign(merged, loadEnvFile(path.join(root, name)));
  }
  return merged;
}

function lockfileCandidates(env) {
  return [
    env.RIOT_LOCKFILE_PATH,
    path.join(env.LOCALAPPDATA || "", "Riot Games", "Riot Client", "Config", "lockfile"),
    path.join(env.LOCALAPPDATA || "", "RiotGames", "Riot Client", "Config", "lockfile"),
    path.join(env.LOCALAPPDATA || "", "Tencent", "VALORANT", "Riot Client", "Config", "lockfile"),
    path.join(env.LOCALAPPDATA || "", "Tencent", "Riot Games", "Riot Client", "Config", "lockfile"),
  ].filter(Boolean);
}

function readLockfile(env) {
  for (const filePath of lockfileCandidates(env)) {
    try {
      const content = fs.readFileSync(filePath, "utf8").trim();
      const parts = content.split(":");
      if (parts.length < 5) continue;
      const port = parts[2];
      const password = parts[3];
      if (port && password) return { port, password, filePath };
    } catch {
      // try next
    }
  }
  return null;
}

function lockfileAuth(lock) {
  return `Basic ${Buffer.from(`riot:${lock.password}`).toString("base64")}`;
}

async function localRiotFetch(lock, apiPath) {
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(`https://127.0.0.1:${lock.port}${apiPath}`, {
      headers: {
        Authorization: lockfileAuth(lock),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

function sessionFromEnv(env) {
  const token = env.RIOT_ACCESS_TOKEN?.trim();
  const entitlements = env.RIOT_ENTITLEMENTS_JWT?.trim();
  if (!token || !entitlements) return null;
  return {
    source: "env",
    authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    entitlements_jwt: entitlements,
    client_version: env.RIOT_CLIENT_VERSION?.trim() || DEFAULT_CLIENT_VERSION,
  };
}

function defaultSessionFile(env) {
  return (
    env.RIOT_SESSION_FILE?.trim() ||
    path.join(env.LOCALAPPDATA || "", "VAL-CN", "session.json")
  );
}

function sessionFromFile(env) {
  const filePath = defaultSessionFile(env);
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const access =
      data.access_token?.trim() ||
      data.accessToken?.trim() ||
      data.authorization?.trim() ||
      "";
    const entitlements =
      data.entitlements_jwt?.trim() ||
      data.entitlementsJwt?.trim() ||
      data.token?.trim() ||
      "";
    if (!access || !entitlements) return null;

    return {
      source: "file",
      filePath,
      updated_at: data.updated_at || null,
      authorization: access.startsWith("Bearer ") ? access : `Bearer ${access}`,
      entitlements_jwt: entitlements,
      client_version:
        data.client_version?.trim() ||
        data.clientVersion?.trim() ||
        DEFAULT_CLIENT_VERSION,
    };
  } catch {
    return null;
  }
}

async function sessionFromLockfile(lock) {
  const entRes = await localRiotFetch(lock, "/entitlements/v1/token");
  if (!entRes.ok) {
    return { error: `entitlements HTTP ${entRes.status}` };
  }
  const entData = await entRes.json();
  const accessToken = String(entData?.accessToken || "").trim();
  const entitlementsToken = String(entData?.token || "").trim();
  if (!accessToken || !entitlementsToken) {
    return { error: "entitlements 响应缺少 token" };
  }

  let clientVersion = DEFAULT_CLIENT_VERSION;
  try {
    const verRes = await localRiotFetch(lock, "/product-session/v1/external-sessions");
    if (verRes.ok) {
      const sessions = await verRes.json();
      const valorant = Object.values(sessions || {}).find(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          String(s.productId || "").includes("valorant"),
      );
      if (valorant?.version) clientVersion = valorant.version;
    }
  } catch {
    // default version
  }

  return {
    source: "lockfile",
    authorization: `Bearer ${accessToken}`,
    entitlements_jwt: entitlementsToken,
    client_version: clientVersion,
  };
}

async function sessionFromValcn(env) {
  const fallbackOff = ["false", "0", "no"].includes(
    String(env.VALCN_FALLBACK || "").trim().toLowerCase(),
  );
  if (fallbackOff) return { skipped: true };

  const url = env.RIOT_SESSION_URL?.trim() || `${VALCN_BASE}/api/session/latest`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { error: `后备 API HTTP ${res.status}` };
    const data = await res.json();
    const session = data?.session;
    if (!session?.authorization || !session?.entitlements_jwt) {
      return { error: "后备 API 无可用公开会话" };
    }
    return {
      source: "fallback",
      authorization: String(session.authorization),
      entitlements_jwt: String(session.entitlements_jwt),
      client_version: String(session.client_version || "").trim() || DEFAULT_CLIENT_VERSION,
      url,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "后备 API 请求失败" };
  }
}

function maskToken(s) {
  const t = String(s || "");
  if (t.length <= 24) return "(过短)";
  return `${t.slice(0, 12)}...${t.slice(-8)} (${t.length} 字符)`;
}

async function main() {
  const env = mergeEnv();
  const valcnOff = ["false", "0", "no"].includes(
    String(env.VALCN_FALLBACK || "").trim().toLowerCase(),
  );

  console.log("");
  console.log("========================================");
  console.log("  VAL CN 会话检查");
  console.log("========================================");
  console.log(`工作目录: ${root}`);
  console.log("");

  // 1. env
  log("▶", "检查 .env.local / .env 中的 Token ...");
  const hasEnvFile = fs.existsSync(path.join(root, ".env.local"));
  log(hasEnvFile ? "  ✓" : "  ·", `.env.local ${hasEnvFile ? "已找到" : "未配置（可忽略）"}`);

  const envSession = sessionFromEnv(env);
  if (envSession) {
    log("  ✓", "已配置手动 Token（优先使用）");
    log("  ·", `access: ${maskToken(envSession.authorization.replace(/^Bearer\s+/, ""))}`);
    printReady(envSession, { lockfile: null, valcnOff });
    process.exit(0);
  }
  log("  ·", "未配置手动 Token，尝试自动获取");
  console.log("");

  // 2. companion session 文件
  log("▶", "检查 Companion 写入的 session.json ...");
  const fileSession = sessionFromFile(env);
  if (fileSession) {
    log("  ✓", `本地会话文件: ${fileSession.filePath}`);
    if (fileSession.updated_at) {
      log("  ·", `更新时间: ${fileSession.updated_at}`);
    }
    log("  ·", `access: ${maskToken(fileSession.authorization.replace(/^Bearer\s+/, ""))}`);
    printReady(fileSession, { lockfile: null, valcnOff });
    process.exit(0);
  }
  log("  ·", `未找到: ${defaultSessionFile(env)}`);
  log("  ·", "可先运行 companion 捕获（见 companion/README.md）");
  console.log("");

  // 3. lockfile
  log("▶", "检查本机 Riot 客户端 lockfile ...");
  const lock = readLockfile(env);
  if (!lock) {
    log("  ✗", "未找到 lockfile（请先启动并登录瓦罗兰特 / Riot Client）");
    for (const p of lockfileCandidates(env)) {
      log("  ·", `  ${p}`);
    }
  } else {
    log("  ✓", `lockfile: ${lock.filePath}`);
    log("  ·", `本地端口: ${lock.port}`);
    console.log("");
    log("▶", "读取本机 Token ...");
    const lf = await sessionFromLockfile(lock);
    if (lf.error) {
      log("  ✗", lf.error);
      log("  ·", "建议：重启游戏客户端后再试");
    } else {
      log("  ✓", "本机 Token 获取成功");
      log("  ·", `客户端版本: ${lf.client_version}`);
      log("  ·", `access: ${maskToken(lf.authorization.replace(/^Bearer\s+/, ""))}`);
      printReady(lf, { lockfile: lock, valcnOff });
      process.exit(0);
    }
  }
  console.log("");

  // 4. valcn
  log("▶", "检查公开后备 API ...");
  if (valcnOff) {
    log("  ·", "VALCN_FALLBACK=false，已关闭后备");
    printFail();
    process.exit(2);
  }

  const vc = await sessionFromValcn(env);
  if (vc.skipped) {
    log("  ·", "后备已关闭");
    printFail();
    process.exit(2);
  }
  if (vc.error) {
    log("  ✗", vc.error);
    printFail();
    process.exit(2);
  }

  log("  ✓", `借用公开后备 Token（${vc.url}）`);
  log("  ·", `access: ${maskToken(vc.authorization.replace(/^Bearer\s+/, ""))}`);
  log("  ·", "可查战绩；对局认人 /live 仍需本机开游戏");
  printReady(vc, { lockfile: null, valcnOff });
  process.exit(0);
}

function printReady(session, { lockfile, valcnOff }) {
  console.log("");
  console.log("----------------------------------------");
  log("✓", `环境就绪 — Token 来源: ${labelSource(session.source)}`);
  if (session.source === "lockfile") {
    log("·", "战绩查询、对局认人均可用");
  } else if (session.source === "file") {
    log("·", "使用 Companion 捕获的 Token（国服推荐）");
  } else if (session.source === "fallback") {
    log("·", "仅战绩查询可用；/live 需本机开瓦罗兰特");
  } else {
    log("·", "使用 .env.local 手动 Token");
  }
  console.log("----------------------------------------");
  console.log("");
}

function printFail() {
  console.log("");
  console.log("----------------------------------------");
  log("✗", "当前无法获取 Token");
  log("·", "方案 1: 启动瓦罗兰特客户端并登录");
  log("·", "方案 2: 编辑 .env.local 填入抓包 Token");
  if (!valcnOff) log("·", "方案 3: 保持 VALCN_FALLBACK=true 并联网");
  console.log("----------------------------------------");
  console.log("");
}

function labelSource(s) {
  if (s === "env") return ".env.local 手动配置";
  if (s === "file") return "Companion session 文件";
  if (s === "lockfile") return "本机游戏客户端（自动）";
  if (s === "fallback") return "公开后备 API";
  return s;
}

main().catch((err) => {
  console.error("");
  console.error("检查脚本异常:", err);
  process.exit(2);
});
