"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { TrendPoint } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_STYLE_LIGHT, CHART_THEME } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

interface Props {
  data: TrendPoint[];
  helpText?: string;
  static?: boolean;
  theme?: "dark" | "light";
  subtitle?: string;
}

export default function TrendChart({ data, helpText, static: isStatic = false, theme = "dark", subtitle }: Props) {
  const t = CHART_THEME[theme];
  const tooltip = theme === "light" ? CHART_TOOLTIP_STYLE_LIGHT : CHART_TOOLTIP_STYLE;
  const mtbfColor = theme === "light" ? "#D97706" : "#F7B708";
  const mttrColor = theme === "light" ? "#E01F5F" : "#E01F5F";
  const dotBorder = theme === "light" ? "#ffffff" : "#1b1819";

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: t.title }}>
          Tendencia MTBF / MTTR
          {helpText && <HelpTip text={helpText} />}
        </h3>
        {subtitle && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: t.subtle }}>{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: t.empty }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
            <XAxis dataKey="month" tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...tooltip}
              formatter={(value, name) => [`${value} h`, name === "mtbf" ? "MTBF" : "MTTR"]}
            />
            <Legend
              formatter={(value: string) => <span style={{ color: t.legend, fontSize: 12 }}>{value === "mtbf" ? "MTBF" : "MTTR"}</span>}
            />
            <Line type="monotone" dataKey="mtbf" stroke={mtbfColor} strokeWidth={2} dot={{ r: 4, fill: mtbfColor }} activeDot={{ r: 6, fill: mtbfColor, stroke: dotBorder, strokeWidth: 2 }} connectNulls isAnimationActive={!isStatic} />
            <Line type="monotone" dataKey="mttr" stroke={mttrColor} strokeWidth={2} dot={{ r: 4, fill: mttrColor }} activeDot={{ r: 6, fill: mttrColor, stroke: dotBorder, strokeWidth: 2 }} connectNulls isAnimationActive={!isStatic} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
