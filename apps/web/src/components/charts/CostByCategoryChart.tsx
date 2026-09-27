"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { CostData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

const COLORS = ["#F7B708", "#E01F5F", "#669991", "#0051FF", "#A3A3A3", "#FF6B35", "#7C3AED"];

interface Props {
  data: CostData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
}

export default function CostByCategoryChart({ data, onFilter, activeFilter, helpText }: Props) {
  return (
    <div className="rounded-2xl border p-6 transition-all" style={{ backgroundColor: "var(--graphite-900)", borderColor: activeFilter ? "var(--tuscan-sun-500)" : "var(--graphite-800)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--graphite-200)" }}>
        Costos por categoria
        {helpText && <HelpTip text={helpText} />}
      </h3>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--graphite-500)" }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#363032" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#9f9396", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="category" tick={{ fill: "#b7aeb1", fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Costo"]}
            />
            <Bar dataKey="costo" radius={[0, 6, 6, 0]} onClick={(entry) => { if (onFilter) onFilter((entry as unknown as CostData).category); }} style={{ cursor: onFilter ? "pointer" : "default" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={activeFilter && activeFilter !== entry.category ? "#51484b" : COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
