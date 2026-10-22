"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { CostData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_STYLE_LIGHT, CHART_THEME } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

const COLORS_DARK = ["#F7B708", "#E01F5F", "#669991", "#0051FF", "#A3A3A3", "#FF6B35", "#7C3AED"];
const COLORS_LIGHT = ["#D97706", "#E01F5F", "#0F766E", "#1D4ED8", "#71717A", "#C2410C", "#6D28D9"];

interface Props {
  data: CostData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
  static?: boolean;
  theme?: "dark" | "light";
  subtitle?: string;
}

export default function CostByCategoryChart({ data, onFilter, activeFilter, helpText, static: isStatic = false, theme = "dark", subtitle }: Props) {
  const t = CHART_THEME[theme];
  const tooltip = theme === "light" ? CHART_TOOLTIP_STYLE_LIGHT : CHART_TOOLTIP_STYLE;
  const colors = theme === "light" ? COLORS_LIGHT : COLORS_DARK;

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: t.title }}>
          Costos por categoria
          {helpText && <HelpTip text={helpText} />}
        </h3>
        {subtitle && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: t.subtle }}>{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: t.empty }}>Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="category" tick={{ fill: t.legend, fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
            <Tooltip
              {...tooltip}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Costo"]}
            />
            <Bar dataKey="costo" radius={[0, 6, 6, 0]} isAnimationActive={!isStatic} onClick={(entry) => { if (onFilter) onFilter((entry as unknown as CostData).category); }} style={{ cursor: onFilter ? "pointer" : "default" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={activeFilter && activeFilter !== entry.category ? t.muted : colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
