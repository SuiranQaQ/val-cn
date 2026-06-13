import { NextResponse } from "next/server";
import { getPlayableAgents } from "@/lib/game-assets";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  try {
    const agents = await getPlayableAgents();
    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json(
      {
        agents: [],
        error: err instanceof Error ? err.message : "agents_load_failed",
      },
      { status: 502 },
    );
  }
}
