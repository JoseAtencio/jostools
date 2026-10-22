"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { VehicleData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_STYLE_LIGHT, CHART_THEME } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

const COLORS_DARK = ["#E01F5F", "#F7B708", "#669991", "#0051FF", "#A3A3A3"];
const COLORS_LIGHT = ["#E01F5F", "#D97706", "#0F766E", "#1D4ED8", "#71717A"];

interface Props {
  data: VehicleData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
  static?: boolean;
  theme?: "dark" | "light";
  title?: string;
  subtitle?: string;
}

export default function TopVehiclesChart({ data, onFilter, activeFilter, helpText, static: isStatic = false, theme = "dark", title = "Top 5 vehiculos con mas fallas", subtitle }: Props) {
  const t = CHART_THEME[theme];
  const tooltip = theme === "light" ? CHART_TOOLTIP_STYLE_LIGHT : CHART_TOOLTIP_STYLE;
  const colors = theme === "light" ? COLORS_LIGHT : COLORS_DARK;

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: t.title }}>
          {title}
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
            <XAxis dataKey="vehicle" tick={{ fill: t.legend, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: t.tick, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...tooltip}
              formatter={(value) => [`${value} fallas`, "Cantidad"]}
            />
            <Bar dataKey="fallas" radius={[6, 6, 0, 0]} isAnimationActive={!isStatic} onClick={(entry) => { if (onFilter) onFilter((entry as unknown as VehicleData).vehicle); }} style={{ cursor: onFilter ? "pointer" : "default" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={activeFilter && activeFilter !== entry.vehicle ? t.muted : colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
