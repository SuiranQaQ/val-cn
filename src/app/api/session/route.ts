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
        "无法获取 Riot 会话。可启动瓦罗兰特客户端，或在 .env.local 填写 Token。",
    });
  }

  const sourceLabel: Record<string, string> = {
    env: "环境变量（自己的 Token）",
    lockfile: "本机客户端 lockfile",
    valcn: "外部会话源（RIOT_SESSION_URL）",
  };

  return NextResponse.json({
    ok: true,
    source,
    source_label: sourceLabel[source] || source,
    client_version: session.client_version,
    token_preview: session.authorization.slice(0, 20) + "...",
  });
}
