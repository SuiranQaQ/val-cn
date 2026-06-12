export type SessionSourceKey = "env" | "lockfile" | "fallback" | "none";

export interface SessionDisplay {
  label: string;
  detail: string;
  ok: boolean;
}

/** 首页会话状态文案（如实说明来源，避免「临时会话」误导） */
export function getSessionDisplay(
  source: string,
  sessionOk: boolean | null,
): SessionDisplay {
  if (sessionOk === null) {
    return {
      label: "检测中",
      detail: "正在检查本机客户端与 Token 配置",
      ok: false,
    };
  }

  if (!sessionOk) {
    return {
      label: "未连接",
      detail: "请启动瓦罗兰特并登录，或在 .env.local 配置 Token",
      ok: false,
    };
  }

  switch (source as SessionSourceKey) {
    case "lockfile":
      return {
        label: "本机游戏",
        detail: "已从客户端读取 Token，查询最稳定",
        ok: true,
      };
    case "env":
      return {
        label: "自建 Token",
        detail: "使用 .env.local 中的凭证，注意过期时间",
        ok: true,
      };
    case "fallback":
      return {
        label: "后备线路",
        detail: "本机未开游戏，使用公开后备接口查战绩（非你的账号，可能不稳定）",
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
