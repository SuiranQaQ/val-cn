import fs from "fs";
import path from "path";
import { APP_DIR, ensureAppDir } from "./paths.mjs";
import { writeLiveMatchCache, clearLiveMatchCache } from "./live-match-cache.mjs";

export const LIVE_TRAFFIC_LOG = path.join(APP_DIR, "live-traffic.log");
export const LIVE_SNAPSHOT_DIR = path.join(APP_DIR, "live-snapshots");

const MAX_LOG_BYTES = 512 * 1024;
const MAX_SNAPSHOTS = 30;

/** 对局认人相关 URL（仅记录白名单，非全局 MITM 日志） */
const LIVE_URL_HINTS = [
  /pregame/i,
  /core-game/i,
  /coregame/i,
  /glz[-/]/i,
  /matchmaking/i,
  /parties/i,
  /party/i,
  /session\/v1\/session/i,
  /chat\/v1\/session/i,
  /current[-_]game/i,
  /restrictions/i,
  /\/matches\//i,
];

function hostBare(host) {
  return String(host || "").split(":")[0].toLowerCase();
}

function isValorantHost(host) {
  const bare = hostBare(host);
  return /(?:^|\.)val\.qq\.com$/i.test(bare);
}

function isTokenOnlyTraffic(host, urlPath) {
  const bare = hostBare(host);
  const p = String(urlPath || "");
  if (!/(?:^|\.)?(?:pd-redge|entitlements|shared-redge)\.val\.qq\.com$/i.test(bare)) {
    return false;
  }
  return /(?:entitlements|\/token\/|oauth|login|auth)/i.test(p);
}

function isLiveTraffic(host, urlPath) {
  if (!isValorantHost(host)) return false;
  if (isTokenOnlyTraffic(host, urlPath)) return false;
  return LIVE_URL_HINTS.some((r) => r.test(String(urlPath || "")));
}

function trimLogFile() {
  try {
    if (!fs.existsSync(LIVE_TRAFFIC_LOG)) return;
    const stat = fs.statSync(LIVE_TRAFFIC_LOG);
    if (stat.size <= MAX_LOG_BYTES) return;
    const lines = fs.readFileSync(LIVE_TRAFFIC_LOG, "utf8").split("\n");
    fs.writeFileSync(LIVE_TRAFFIC_LOG, `${lines.slice(-400).join("\n")}\n`, "utf8");
  } catch {
    // ignore
  }
}

function appendLog(line) {
  ensureAppDir();
  trimLogFile();
  fs.appendFileSync(LIVE_TRAFFIC_LOG, `${line}\n`, "utf8");
}

function countRosterPlayers(data) {
  const direct = data.Players || data.players;
  if (Array.isArray(direct) && direct.length) return direct.length;

  const teams = data.Teams || data.teams;
  if (Array.isArray(teams)) {
    let count = 0;
    for (const team of teams) {
      count += (team.Players || team.players || []).length;
    }
    if (count) return count;
  }

  let count = 0;
  for (const key of ["AllyTeam", "EnemyTeam", "allyTeam", "enemyTeam"]) {
    const team = data[key];
    if (team) count += (team.Players || team.players || []).length;
  }
  return count;
}

function matchPhaseFromUrl(url) {
  const p = String(url || "");
  if (
    /\/core-game\/v1\/matches\//i.test(p) &&
    !/\/loadouts|muctoken|chattoken|allchat|teamchat/i.test(p)
  ) {
    return "ingame";
  }
  if (
    /\/pregame\/v1\/matches\//i.test(p) &&
    !/\/loadouts|chattoken|voicetoken/i.test(p)
  ) {
    return "pregame";
  }
  return null;
}

const TERMINAL_MATCH_STATES = new Set([
  "POST_GAME",
  "COMPLETED",
  "FINISHED",
  "ENDED",
]);

function isLiveMatchBodyActive(data) {
  if (!data || typeof data !== "object") return false;
  const state = String(data.State || data.state || "").toUpperCase();
  if (state && TERMINAL_MATCH_STATES.has(state)) return false;
  const pre = String(data.PregameState || data.pregameState || "").toLowerCase();
  if (
    pre.includes("finished") ||
    pre.includes("ended") ||
    pre.includes("complete")
  ) {
    return false;
  }
  return true;
}

function isPlayerLeaveSignal(url, statusCode, method) {
  const p = String(url || "");
  if (
    /\/(pregame|core-game)\/v1\/players\//i.test(p) &&
    (statusCode === 404 || statusCode === 410)
  ) {
    return true;
  }
  if (
    method === "POST" &&
    /\/core-game\/v1\/players\/[^/]+\/disassociate\//i.test(p) &&
    (statusCode === 204 || statusCode === 200)
  ) {
    return true;
  }
  return false;
}

function analyzeBody(body) {
  try {
    const data = JSON.parse(body);
    const rosterCount = countRosterPlayers(data);
    const matchId = String(
      data.MatchID || data.matchId || data.ID || data.id || "",
    ).trim();

    if (rosterCount >= 2) {
      return {
        kind: "match_players",
        player_count: rosterCount,
        match_id: matchId,
        map_id: String(data.MapID || data.mapId || data.MapId || ""),
        data,
      };
    }

    if (matchId && (data.Subject || data.subject || data.TeamID || data.teamId)) {
      return { kind: "player_state", match_id: matchId, data };
    }
    if (matchId) {
      return { kind: "match_ref", match_id: matchId, data };
    }
  } catch {
    // not json
  }
  return null;
}

function maybeWriteLiveMatchCache(host, url, snapshot) {
  const phase = matchPhaseFromUrl(url);
  if (!phase || snapshot.kind !== "match_players" || !snapshot.match_id) return;
  if (!isLiveMatchBodyActive(snapshot.data)) {
    if (clearLiveMatchCache()) {
      console.log("[live-traffic] cleared live-match cache (terminal state)");
    }
    return;
  }
  writeLiveMatchCache({
    phase,
    match_id: snapshot.match_id,
    host,
    url,
    body: snapshot.data,
  });
}

function saveSnapshot(host, url, status, snapshot, unexpected = false) {
  ensureAppDir();
  fs.mkdirSync(LIVE_SNAPSHOT_DIR, { recursive: true });

  const safe = String(url || "/")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
  const prefix = unexpected ? "unexpected" : snapshot.kind;
  const name = `${Date.now()}_${prefix}_${safe}.json`;
  const filePath = path.join(LIVE_SNAPSHOT_DIR, name);

  const payload = {
    captured_at: new Date().toISOString(),
    host,
    url,
    status,
    kind: snapshot.kind,
    unexpected,
    match_id: snapshot.match_id || null,
    player_count: snapshot.player_count || null,
    map_id: snapshot.map_id || null,
    body: snapshot.data,
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[live-traffic] ★ snapshot ${prefix} → ${filePath}`);
  appendLog(
    `[${new Date().toISOString()}] SNAP ${prefix} ${host}${url} → ${name}`,
  );
  pruneSnapshots();
}

function pruneSnapshots() {
  try {
    const files = fs
      .readdirSync(LIVE_SNAPSHOT_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(LIVE_SNAPSHOT_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const f of files.slice(MAX_SNAPSHOTS)) {
      fs.unlinkSync(path.join(LIVE_SNAPSHOT_DIR, f.name));
    }
  } catch {
    // ignore
  }
}

/** 记录对局相关 HTTPS 请求（白名单 URL，非全局） */
export function logLiveRequest({ host, url, method }) {
  if (isPlayerLeaveSignal(url, 204, method)) {
    if (clearLiveMatchCache()) {
      console.log("[live-traffic] cleared live-match cache (disassociate)");
    }
  }
  if (!isLiveTraffic(host, url)) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] REQ ${method || "GET"} ${host}${url}`;
  appendLog(line);
  console.log(`[live-traffic] → ${method || "GET"} ${host}${url}`);
}

/** 记录响应；若 JSON 像对局数据则额外保存 snapshot */
export function logLiveResponse({ host, url, statusCode, body, method }) {
  const size = body?.length || 0;
  const status = statusCode || 0;

  if (isPlayerLeaveSignal(url, status, method)) {
    if (clearLiveMatchCache()) {
      console.log("[live-traffic] cleared live-match cache (player left match)");
    }
  }

  const tracked = isLiveTraffic(host, url);
  const snapshot =
    size > 0 && size < 512_000 ? analyzeBody(body) : null;

  if (tracked) {
    const ts = new Date().toISOString();
    appendLog(`[${ts}] RES ${status} ${host}${url} (${size} bytes)`);
    console.log(`[live-traffic] ← ${status} ${host}${url} (${size} bytes)`);
  }

  if (!snapshot) return;

  if (tracked) {
    saveSnapshot(host, url, status, snapshot, false);
    maybeWriteLiveMatchCache(host, url, snapshot);
    return;
  }

  if (isValorantHost(host)) {
    const ts = new Date().toISOString();
    appendLog(
      `[${ts}] RES ${status} ${host}${url} (${size} bytes) [unexpected-match-json]`,
    );
    console.log(
      `[live-traffic] ★ 未预期 URL 含对局 JSON: ${host}${url}`,
    );
    saveSnapshot(host, url, status, snapshot, true);
    maybeWriteLiveMatchCache(host, url, snapshot);
  }
}

export function getLiveTrafficMeta() {
  const meta = {
    log_path: LIVE_TRAFFIC_LOG,
    log_exists: false,
    log_bytes: 0,
    snapshot_dir: LIVE_SNAPSHOT_DIR,
    snapshot_count: 0,
    latest_snapshot_at: null,
  };

  try {
    if (fs.existsSync(LIVE_TRAFFIC_LOG)) {
      meta.log_exists = true;
      meta.log_bytes = fs.statSync(LIVE_TRAFFIC_LOG).size;
    }
    if (fs.existsSync(LIVE_SNAPSHOT_DIR)) {
      const files = fs
        .readdirSync(LIVE_SNAPSHOT_DIR)
        .filter((f) => f.endsWith(".json"));
      meta.snapshot_count = files.length;
      if (files.length) {
        const latest = files
          .map((f) => ({
            f,
            m: fs.statSync(path.join(LIVE_SNAPSHOT_DIR, f)).mtimeMs,
          }))
          .sort((a, b) => b.m - a.m)[0];
        meta.latest_snapshot_at = new Date(latest.m).toISOString();
      }
    }
  } catch {
    // ignore
  }

  return meta;
}
