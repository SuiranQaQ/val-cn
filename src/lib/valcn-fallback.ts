/** 公开后备 API（会话 + 名字解析），默认开启，设 VALCN_FALLBACK=false 可关闭 */
export function isValcnFallbackEnabled(): boolean {
  const v = process.env.VALCN_FALLBACK?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

export const VALCN_BASE =
  process.env.VALCN_BASE_URL?.trim() ||
  process.env.NAME_RESOLVE_BASE_URL?.trim() ||
  "https://valcn.top";
