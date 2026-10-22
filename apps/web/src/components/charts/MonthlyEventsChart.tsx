"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { BarData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_STYLE_LIGHT, CHART_THEME } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

interface Props {
  data: BarData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
  static?: boolean;
  theme?: "dark" | "light";
  subtitle?: string;
}

export default function MonthlyEventsChart({ data, onFilter, activeFilter, helpText, static: isStatic = false, theme = "dark", subtitle }: Props) {
  const t = CHART_THEME[theme];
  const tooltip = theme === "light" ? CHART_TOOLTIP_STYLE_LIGHT : CHART_TOOLTIP_STYLE;
  const barColor = theme === "light" ? "#D97706" : "#F7B708";

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: t.title }}>
          Eventos por mes
          {helpText && <HelpTip text={helpText} />}
        </h3>
        {subtitle && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: t.subtle }}>{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: t.empty }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
            <XAxis dataKey="month" tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...tooltip}
              formatter={(value) => [`${value} eventos`, "Cantidad"]}
            />
            <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} isAnimationActive={!isStatic} onClick={(entry) => { if (onFilter) onFilter((entry as unknown as BarData).month); }} style={{ cursor: onFilter ? "pointer" : "default" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={activeFilter && activeFilter !== entry.month ? t.muted : barColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
