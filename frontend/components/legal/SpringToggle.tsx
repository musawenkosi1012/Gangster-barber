"use client";

import React, { useState } from "react";
import { useLegal } from "@/context/LegalContext";

interface SpringToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: React.ReactNode;
  id?: string;
}

/**
 * SpringToggle — a clipper power-switch aesthetic toggle.
 * Heavy mechanical feel via cubic-bezier overshoot spring.
 * Returns boolean state to parent form.
 */
export function SpringToggle({ checked, onChange, label, id = "spring-toggle" }: SpringToggleProps) {
  const [pressing, setPressing] = useState(false);

  return (
    <label
      htmlFor={id}
      className="flex items-start gap-4 cursor-pointer group select-none"
    >
      {/* ── The Switch ── */}
      <div className="relative shrink-0 mt-0.5">
        {/* Casing */}
        <div
          className={`
            relative w-14 h-7 rounded-full transition-all duration-300
            ${checked
              ? "bg-gradient-to-r from-red-700 to-red-500 shadow-[0_0_16px_rgba(220,38,38,0.5)]"
              : "bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]"
            }
            border ${checked ? "border-red-600/40" : "border-white/[0.06]"}
          `}
          style={{
            boxShadow: checked
              ? "0 0 20px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
              : "inset 0 2px 6px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Grip lines on casing */}
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-20">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-white/40"
                style={{ left: `${18 + i * 5}%` }}
              />
            ))}
          </div>

          {/* Actuator / Thumb */}
          <div
            onMouseDown={() => setPressing(true)}
            onMouseUp={() => setPressing(false)}
            onMouseLeave={() => setPressing(false)}
            className={`
              absolute top-0.5 w-6 h-6 rounded-full
              bg-gradient-to-b from-[#e8e8e8] to-[#b0b0b0]
              border border-white/20
              transition-all
            `}
            style={{
              left: checked ? "calc(100% - 1.75rem)" : "0.125rem",
              transform: pressing ? "scale(0.88)" : "scale(1)",
              transition: "left 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.1s ease, background 0.3s ease",
              boxShadow: checked
                ? "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.6)"
                : "0 2px 8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.4)",
              background: checked
                ? "linear-gradient(to bottom, #ffffff, #e0e0e0)"
                : "linear-gradient(to bottom, #d0d0d0, #888)",
            }}
          >
            {/* Center dot */}
            <div
              className={`absolute inset-0 flex items-center justify-center`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${checked ? "bg-red-600/80" : "bg-white/20"} transition-colors duration-300`} />
            </div>
          </div>

          {/* Status indicator glow */}
          {checked && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
          )}
        </div>

        {/* Power label */}
        <div className="absolute -bottom-4 left-0 right-0 text-center">
          <span className={`text-[7px] font-black uppercase tracking-widest transition-colors ${checked ? "text-emerald-500" : "text-white/20"}`}>
            {checked ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Hidden native checkbox */}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />

      {/* Label copy */}
      <div className="pt-1 flex-1">
        {label}
      </div>
    </label>
  );
}
