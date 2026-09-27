"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { BarData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

interface Props {
  data: BarData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
}

export default function MonthlyEventsChart({ data, onFilter, activeFilter, helpText }: Props) {
  return (
    <div className="rounded-2xl border p-6 transition-all" style={{ backgroundColor: "var(--graphite-900)", borderColor: activeFilter ? "var(--tuscan-sun-500)" : "var(--graphite-800)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--graphite-200)" }}>
        Eventos por mes
        {helpText && <HelpTip text={helpText} />}
      </h3>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--graphite-500)" }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#363032" />
            <XAxis dataKey="month" tick={{ fill: "#9f9396", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#9f9396", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value) => [`${value} eventos`, "Cantidad"]}
            />
            <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} onClick={(entry) => { if (onFilter) onFilter((entry as unknown as BarData).month); }} style={{ cursor: onFilter ? "pointer" : "default" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={activeFilter && activeFilter !== entry.month ? "#51484b" : "#F7B708"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
