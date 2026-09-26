"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { PieData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE } from "./chartStyles";

const LABELS: Record<string, string> = { Correctivos: "Correctivos", Preventivos: "Preventivos", Inspecciones: "Inspecciones" };

interface Props {
  data: PieData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
}

export default function EventTypePieChart({ data, onFilter, activeFilter }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border p-6 transition-all" style={{ backgroundColor: "var(--graphite-900)", borderColor: activeFilter ? "var(--tuscan-sun-500)" : "var(--graphite-800)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--graphite-200)" }}>Distribucion por tipo de evento</h3>
      {total === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--graphite-500)" }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              onClick={(_, index) => { if (onFilter) onFilter(data[index].key); }}
              style={{ cursor: onFilter ? "pointer" : "default" }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} opacity={activeFilter && activeFilter !== entry.key ? 0.3 : 1} />
              ))}
            </Pie>
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value) => [`${value} (${((Number(value) / total) * 100).toFixed(0)}%)`, ""]}
            />
            <Legend
              formatter={(value: string) => <span style={{ color: "#b7aeb1", fontSize: 12 }}>{LABELS[value] ?? value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
