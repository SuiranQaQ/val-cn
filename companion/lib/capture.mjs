import { writeSession } from "./session-file.mjs";

const VAL_QQ_HOST = /(?:^|\.)val\.qq\.com(?::\d+)?$/i;

function headerValue(headers, name) {
  if (!headers) return "";
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  const value = key ? headers[key] : "";
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}

function hostFromHeaders(headers) {
  return headerValue(headers, "host").toLowerCase();
}

function isValorantHost(host) {
  if (!host) return false;
  const bare = host.split(":")[0];
  return VAL_QQ_HOST.test(bare) || VAL_QQ_HOST.test(host);
}

function maskToken(token) {
  const t = String(token || "");
  if (t.length <= 20) return "(short)";
  return `${t.slice(0, 10)}...${t.slice(-6)}`;
}

function logCaptured(source, access, entitlements) {
  console.log(
    `[capture] ${source} access=${maskToken(access)} ent=${maskToken(entitlements)}`,
  );
}

function isGameSessionHost(host) {
  if (!host) return false;
  // glz / shared 在大厅、对局也会带 JWT，需同步刷新 session.json
  return (
    /pd-redge\.val\.qq\.com/i.test(host) ||
    /entitlements\.val\.qq\.com/i.test(host) ||
    /glz-redge\.val\.qq\.com/i.test(host) ||
    /shared-redge\.val\.qq\.com/i.test(host)
  );
}

function looksLikeJwt(value) {
  const t = String(value || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return t.startsWith("eyJ") && t.split(".").length === 3;
}

/**
 * 从 HTTPS 请求头捕获（仅 pd-redge / entitlements 域名）
 */
export function captureFromRequestHeaders(headers) {
  const host = hostFromHeaders(headers);
  if (!isValorantHost(host) || !isGameSessionHost(host)) return false;

  const authorization = headerValue(headers, "authorization");
  const entitlements = headerValue(headers, "x-riot-entitlements-jwt");
  const clientVersion = headerValue(headers, "x-riot-clientversion");
  const clientPlatform = headerValue(headers, "x-riot-clientplatform");

  if (!authorization || !entitlements) return false;
  if (!looksLikeJwt(authorization) || !looksLikeJwt(entitlements)) return false;

  const wrote = writeSession({
    access_token: authorization,
    entitlements_jwt: entitlements,
    client_version: clientVersion,
    client_platform: clientPlatform,
  });
  if (wrote) logCaptured(`request:${host}`, authorization, entitlements);
  return wrote;
}

/**
 * entitlements 接口响应体：{ accessToken, token } 或类似字段
 */
export function captureFromEntitlementsBody(host, url, bodyText) {
  if (!isValorantHost(host)) return false;
  if (!/entitlements/i.test(url) && !/\/api\/token\/v1/i.test(url)) {
    return false;
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return false;
  }

  const access =
    data.accessToken ||
    data.access_token ||
    data.token?.accessToken ||
    "";
  const entitlements =
    data.token ||
    data.entitlements_token ||
    data.entitlements_jwt ||
    data.entitlementsToken ||
    "";

  if (typeof entitlements === "object") return false;
  if (!access || !entitlements) return false;
  if (!looksLikeJwt(access) || !looksLikeJwt(entitlements)) return false;

  const wrote = writeSession({
    access_token: access,
    entitlements_jwt: entitlements,
  });
  if (wrote) logCaptured(`response:${host}${url}`, access, entitlements);
  return wrote;
}

/**
 * OAuth / RSO 响应里常见的 access_token 字段（需与 entitlements 合并）
 */
export function captureFromOAuthBody(host, url, bodyText) {
  if (!isValorantHost(host)) return false;
  if (!/(?:token|oauth|session|login|auth)/i.test(url)) return false;

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return false;
  }

  const access =
    data.access_token ||
    data.accessToken ||
    data.token?.access_token ||
    "";
  if (!access) return false;

  const entitlements =
    data.entitlements_token || data.entitlements_jwt || "";
  if (!entitlements || !looksLikeJwt(access) || !looksLikeJwt(entitlements)) {
    return false;
  }

  const wrote = writeSession({
    access_token: access,
    entitlements_jwt: entitlements,
  });
  if (wrote) logCaptured(`oauth:${host}${url}`, access, "");
  return wrote;
}
