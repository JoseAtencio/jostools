export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1b1819",
    border: "1px solid #363032",
    borderRadius: 12,
    color: "#e7e4e5",
    fontSize: 13,
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "#cfc9cb", fontWeight: 600 as const, marginBottom: 4 },
  itemStyle: { color: "#e7e4e5", padding: 0 },
  cursor: { fill: "rgba(255,255,255,0.05)" },
};

export const CHART_TOOLTIP_STYLE_LIGHT = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 12,
    color: "#27272a",
    fontSize: 13,
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
  },
  labelStyle: { color: "#52525b", fontWeight: 600 as const, marginBottom: 4 },
  itemStyle: { color: "#27272a", padding: 0 },
  cursor: { fill: "rgba(0,0,0,0.04)" },
};

export const CHART_THEME = {
  dark: {
    cardBg: "var(--graphite-900)",
    cardBorder: "var(--graphite-800)",
    title: "var(--graphite-200)",
    grid: "#363032",
    tick: "#9f9396",
    legend: "#b7aeb1",
    empty: "var(--graphite-500)",
    muted: "#51484b",
    subtle: "#8d8285",
  },
  light: {
    cardBg: "#ffffff",
    cardBorder: "#e4e4e7",
    title: "#18181b",
    grid: "#e4e4e7",
    tick: "#52525b",
    legend: "#3f3f46",
    empty: "#a1a1aa",
    muted: "#d4d4d8",
    subtle: "#71717a",
  },
} as const;

