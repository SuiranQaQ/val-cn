import { NextResponse } from "next/server";
import { getRiotSession, getSessionSource } from "@/lib/riot-session";

/** 检查当前 Riot 会话是否可用（不泄露 token 内容） */
export async function GET() {
  const session = await getRiotSession();

  const source = getSessionSource();

  if (!session) {
    return NextResponse.json({
      ok: false,
      source,
      message:
        "无法获取 Riot 会话。请保持 VALCN_FALLBACK 开启，或配置伴生 session 文件。",
    });
  }

  const sourceLabel: Record<string, string> = {
    env: "环境变量",
    file: "Companion 本机会话",
    pool: "官网公用池",
    lockfile: "本机 lockfile",
    fallback: "公开后备 Token 池",
  };

  return NextResponse.json({
    ok: true,
    source,
    source_label: sourceLabel[source] || source,
    client_version: session.client_version,
    token_preview: session.authorization.slice(0, 20) + "...",
  });
}
