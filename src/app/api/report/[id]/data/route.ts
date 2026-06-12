import { NextRequest, NextResponse } from "next/server";

const VALCN_BASE = process.env.VALCN_BASE_URL || "https://valcn.top";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const queryId = String(id || "").trim();
  if (!queryId) {
    return NextResponse.json({ error: "missing_query_id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${VALCN_BASE}/api/report/${encodeURIComponent(queryId)}/data`,
      { cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "request_failed" }, { status: 502 });
  }
}
