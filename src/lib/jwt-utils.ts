/** 解析 JWT payload（不校验签名） */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const raw = token.replace(/^Bearer\s+/i, "").trim();
  const parts = raw.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jwtExpiresAtMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  return exp > 0 ? exp * 1000 : null;
}

export function isJwtExpired(token: string, skewMs = 60_000): boolean {
  const expMs = jwtExpiresAtMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - skewMs;
}
