"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { PieData } from "@/lib/services/indicatorService";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_STYLE_LIGHT, CHART_THEME } from "./chartStyles";
import HelpTip from "@/components/HelpTip";

const LABELS: Record<string, string> = { Correctivos: "Correctivos", Preventivos: "Preventivos", Inspecciones: "Inspecciones", Predictivos: "Predictivos" };

interface Props {
  data: PieData[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
  helpText?: string;
  static?: boolean;
  theme?: "dark" | "light";
  subtitle?: string;
}

export default function EventTypePieChart({ data, onFilter, activeFilter, helpText, static: isStatic = false, theme = "dark", subtitle }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const t = CHART_THEME[theme];
  const tooltip = theme === "light" ? CHART_TOOLTIP_STYLE_LIGHT : CHART_TOOLTIP_STYLE;

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: t.title }}>
          Distribucion por tipo de evento
          {helpText && <HelpTip text={helpText} />}
        </h3>
        {subtitle && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: t.subtle }}>{subtitle}</p>}
      </div>
      {total === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: t.empty }}>Sin datos</p>
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
              isAnimationActive={!isStatic}
              onClick={(_, index) => { if (onFilter) onFilter(data[index].key); }}
              style={{ cursor: onFilter ? "pointer" : "default" }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} opacity={activeFilter && activeFilter !== entry.key ? 0.3 : 1} />
              ))}
            </Pie>
            <Tooltip
              {...tooltip}
              formatter={(value) => [`${value} (${((Number(value) / total) * 100).toFixed(0)}%)`, ""]}
            />
            <Legend
              formatter={(value: string) => <span style={{ color: t.legend, fontSize: 12 }}>{LABELS[value] ?? value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
