"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { TrendPoint } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE } from "./chartStyles";

interface Props {
  data: TrendPoint[];
}

export default function TrendChart({ data }: Props) {
  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--graphite-200)" }}>Tendencia MTBF / MTTR</h3>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--graphite-500)" }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#363032" />
            <XAxis dataKey="month" tick={{ fill: "#9f9396", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#9f9396", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value, name) => [`${value} h`, name === "mtbf" ? "MTBF" : "MTTR"]}
            />
            <Legend
              formatter={(value: string) => <span style={{ color: "#b7aeb1", fontSize: 12 }}>{value === "mtbf" ? "MTBF" : "MTTR"}</span>}
            />
            <Line type="monotone" dataKey="mtbf" stroke="#F7B708" strokeWidth={2} dot={{ r: 4, fill: "#F7B708" }} activeDot={{ r: 6, fill: "#F7B708", stroke: "#1b1819", strokeWidth: 2 }} connectNulls />
            <Line type="monotone" dataKey="mttr" stroke="#E01F5F" strokeWidth={2} dot={{ r: 4, fill: "#E01F5F" }} activeDot={{ r: 6, fill: "#E01F5F", stroke: "#1b1819", strokeWidth: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
