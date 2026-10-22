"use client";

import { useMemo, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  maxHeight?: number;
  emptyText?: string;
}

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = "Buscar...",
  maxHeight = 160,
  emptyText = "Sin opciones",
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.value}`.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        {label ? (
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--graphite-400)" }}>
            {label}
            {selected.length > 0 && (
              <span className="ml-1.5" style={{ color: "var(--tuscan-sun-400)" }}>({selected.length})</span>
            )}
          </span>
        ) : (
          <span />
        )}
        {options.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="text-xs px-2 py-0.5 rounded-md cursor-pointer transition-colors"
              style={{ color: "var(--ash-grey-400)", backgroundColor: "rgba(102, 153, 145, 0.12)" }}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs px-2 py-0.5 rounded-md cursor-pointer transition-colors"
              style={{ color: "var(--graphite-400)", backgroundColor: "var(--graphite-800)" }}
            >
              Ninguno
            </button>
          </div>
        )}
      </div>

      {searchable && (
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--graphite-500)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ backgroundColor: "var(--graphite-950)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
          />
        </div>
      )}

      <div
        className="rounded-lg overflow-y-auto"
        style={{ maxHeight, border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-950)" }}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs" style={{ color: "var(--graphite-500)" }}>{emptyText}</p>
        ) : (
          filtered.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                style={{ borderTop: "1px solid var(--graphite-900)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="cursor-pointer flex-shrink-0"
                  style={{ accentColor: "var(--tuscan-sun-500)" }}
                />
                <span className="text-xs truncate" style={{ color: checked ? "var(--graphite-50)" : "var(--graphite-300)" }}>
                  {opt.label}
                </span>
                {opt.hint && (
                  <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "var(--graphite-500)" }}>{opt.hint}</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
