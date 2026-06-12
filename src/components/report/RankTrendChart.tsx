"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankTrendPoint } from "@/lib/stats";
import { getRankName } from "@/lib/constants";

export function RankTrendChart({
  data,
  capturing = false,
}: {
  data: RankTrendPoint[];
  capturing?: boolean;
}) {
  const chart = (
    <LineChart
      data={data}
      width={capturing ? 960 : undefined}
      height={capturing ? 88 : undefined}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
      <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 9 }} />
      <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} width={24} />
      <Tooltip
        contentStyle={{
          background: "#111827",
          border: "1px solid #ffffff15",
          fontSize: 11,
        }}
        formatter={(value, name, item) => {
          const payload = item.payload as RankTrendPoint;
          if (name === "tier") return [getRankName(payload.tier), "段位"];
          return [value, name];
        }}
      />
      <Line
        type="monotone"
        dataKey="rr"
        stroke="#ff4655"
        strokeWidth={2}
        dot={{ r: 2, fill: "#ff4655" }}
      />
    </LineChart>
  );

  return (
    <div className="h-28 rounded-2xl border border-white/5 bg-[#1a2332]/80 p-2 md:col-span-4">
      <p className="mb-2 text-[10px] text-gray-500">段位趋势</p>
      {data.length === 0 ? (
        <div className="flex h-[calc(100%-1.2rem)] items-center justify-center rounded-lg bg-white/5 text-[10px] text-gray-500">
          暂无段位趋势数据
        </div>
      ) : capturing ? (
        <div className="h-[calc(100%-1.2rem)] overflow-hidden">{chart}</div>
      ) : (
        <div className="h-[calc(100%-1.2rem)]">
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
