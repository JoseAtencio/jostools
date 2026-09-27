"use client";

interface HelpTipProps {
  text: string;
  title?: string;
}

export default function HelpTip({ text, title }: HelpTipProps) {
  return (
    <span className="group relative inline-flex align-middle ml-1.5 cursor-help">
      <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold leading-none transition-colors border-[var(--graphite-600)] text-[var(--graphite-500)] group-hover:border-[var(--graphite-400)] group-hover:text-[var(--graphite-200)]">
        ?
      </span>
      <span
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 w-72 max-w-xs rounded-xl border px-3 py-2 text-xs font-normal leading-relaxed opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{
          backgroundColor: "var(--graphite-900)",
          borderColor: "var(--graphite-700)",
          color: "var(--graphite-100)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        }}
      >
        <span className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 border-r border-b" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} />
        {title && (
          <span className="block mb-1 font-semibold" style={{ color: "var(--graphite-50)" }}>
            {title}
          </span>
        )}
        {text}
      </span>
    </span>
  );
}
