"use client";

import { useState, useRef, useEffect } from "react";
import HelpTip from "@/components/HelpTip";

interface Option {
  name: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
  onCreateNew?: (value: string) => void | Promise<void>;
  onRemove?: (name: string) => void | Promise<void>;
}

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Buscar o seleccionar...",
  required = false,
  disabled = false,
  helpText,
  onCreateNew,
  onRemove,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.name === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setNewValue(search);
    setCreateError(null);
  }, [search]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setSearch("");
      setAdding(false);
    }
  }, [disabled]);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setSearch("");
    setAdding(false);
  };

  const handleCreate = async () => {
    const text = newValue.trim();
    if (!text || !onCreateNew || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateNew(text);
      setSearch("");
      setNewValue("");
      setIsOpen(false);
      setAdding(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "No se pudo agregar la opcion");
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (opt: Option) => {
    if (!onRemove || removing) return;
    if (!window.confirm(`Eliminar la opcion "${opt.label}"?`)) return;
    setRemoving(opt.name);
    try {
      await onRemove(opt.name);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo eliminar la opcion");
    } finally {
      setRemoving(null);
    }
  };

  const inputStyle = {
    backgroundColor: "var(--graphite-800)",
    border: "1px solid var(--graphite-600)",
    color: "var(--graphite-100)",
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
        {label} {required && <span style={{ color: "var(--raspberry-red-400)" }}>*</span>}
        {helpText && <HelpTip text={helpText} />}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full px-4 py-3 rounded-xl text-sm text-left flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          ...inputStyle,
          borderColor: isOpen ? "var(--tuscan-sun-500)" : "var(--graphite-600)",
        }}
      >
        <span style={{ color: selectedOption ? "var(--graphite-100)" : "var(--graphite-500)" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className="w-4 h-4 transition-transform"
          style={{ color: "var(--graphite-400)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl shadow-xl overflow-hidden"
          style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)" }}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: "1px solid var(--graphite-700)" }}>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--graphite-400)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escriba para filtrar..."
                disabled={adding}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--graphite-900)",
                  color: "var(--graphite-100)",
                  border: "1px solid var(--graphite-700)",
                }}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--graphite-500)" }}>
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={`${opt.name}-${idx}`}
                  className="flex items-center"
                  style={{
                    backgroundColor: value === opt.name ? "rgba(247, 183, 8, 0.1)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (value !== opt.name) {
                      e.currentTarget.style.backgroundColor = "var(--graphite-700)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value !== opt.name) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.name)}
                    className="flex-1 min-w-0 px-4 py-3 text-left text-sm flex items-center gap-3 cursor-pointer"
                    style={{
                      color: value === opt.name ? "var(--tuscan-sun-400)" : "var(--graphite-200)",
                    }}
                  >
                    {value === opt.name && (
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--tuscan-sun-400)" }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemove(opt)}
                      disabled={removing !== null}
                      title="Eliminar opcion"
                      className="px-3 py-2 mr-1 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: "var(--graphite-500)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--raspberry-red-400)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}

            {onCreateNew && (
              <button
                type="button"
                onClick={() => {
                  setAdding((prev) => !prev);
                  setNewValue(search);
                  setCreateError(null);
                }}
                className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 cursor-pointer"
                style={{
                  position: "sticky",
                  bottom: 0,
                  backgroundColor: "var(--graphite-800)",
                  borderTop: "1px solid var(--graphite-700)",
                  color: adding ? "var(--graphite-400)" : "var(--tuscan-sun-400)",
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {adding
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
                </svg>
                {adding ? "Cancelar" : "Agregar nuevo"}
              </button>
            )}
          </div>

          {adding && (
            <div className="p-2 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--graphite-700)" }}>
              <div className="flex gap-2">
                <input
                  ref={addInputRef}
                  type="text"
                  value={newValue}
                  onChange={(e) => { setNewValue(e.target.value); setCreateError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
                  placeholder="Escriba la nueva opcion..."
                  disabled={creating}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm focus:outline-none disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--graphite-900)",
                    color: "var(--graphite-100)",
                    border: "1px solid var(--graphite-700)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newValue.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
                >
                  {creating ? "Guardando..." : "Agregar"}
                </button>
              </div>
              {createError && (
                <p className="text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{createError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
