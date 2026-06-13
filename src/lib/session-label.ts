import { isClientApp } from "./app-mode";

export type SessionSourceKey =
  | "env"
  | "file"
  | "pool"
  | "lockfile"
  | "fallback"
  | "none";

export interface SessionDisplay {
  label: string;
  detail: string;
  ok: boolean;
}

/** 首页会话状态文案 */
export function getSessionDisplay(
  source: string,
  sessionOk: boolean | null,
  poolTotal?: number,
): SessionDisplay {
  const client = isClientApp();

  if (sessionOk === null) {
    return {
      label: "检测中",
      detail: client
        ? "正在检查本机客户端与 Token 配置"
        : "正在检查公用 Token 池与公开线路",
      ok: false,
    };
  }

  if (!sessionOk) {
    return {
      label: "未连接",
      detail: client
        ? "公开后备未开启且无可用的本地会话，请检查 Companion 或 VALCN_FALLBACK"
        : "公用池与公开后备均不可用，请稍后再试或下载客户端自行查询",
      ok: false,
    };
  }

  switch (source as SessionSourceKey) {
    case "file":
      return {
        label: "内置伴生",
        detail: "Companion 已捕获本机 Token，优先于公开池",
        ok: true,
      };
    case "lockfile":
      return {
        label: "本机客户端",
        detail: "已从 lockfile 读取 Token（需客户端正在运行）",
        ok: true,
      };
    case "env":
      return {
        label: client ? "自建 Token" : "运维 Token",
        detail: client ? "使用环境变量中的凭证" : "使用服务器配置的凭证",
        ok: true,
      };
    case "pool":
      return {
        label: client ? "官网公用池" : "公用 Token 池",
        detail: client
          ? "使用老好人模式贡献的 Token"
          : `社区贡献的 Token${poolTotal != null ? `（池内 ${poolTotal} 条）` : ""}，可直接查战绩`,
        ok: true,
      };
    case "fallback":
      return {
        label: "公开线路",
        detail: client
          ? "零配置查战绩（公开 Token 池，与 valcn 同类方案）"
          : "公用池暂空，已切换公开后备线路",
        ok: true,
      };
    default:
      return {
        label: "已连接",
        detail: "可以开始查询",
        ok: true,
      };
  }
}
