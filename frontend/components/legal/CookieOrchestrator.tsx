"use client";

import React, { useEffect, useState } from "react";
import { useLegal } from "@/context/LegalContext";

const CONSENT_KEY = "gb_cookie_consent";
const CONSENT_VERSION = "1.0";

interface ConsentState {
  version: string;
  analytics: boolean;
  staffPerformance: boolean;
  marketing: boolean;
  timestamp: string;
}

const categories = [
  {
    id: "analytics" as const,
    label: "Analytics",
    icon: "◈",
    description: "Google Analytics — tells us which pages are popular so we can improve the booking flow. All data is anonymised.",
    required: false,
  },
  {
    id: "staffPerformance" as const,
    label: "Staff Performance",
    icon: "◉",
    description: "Tracks booking completion rates per service to help our barbers understand demand. Never shared outside the shop.",
    required: false,
  },
  {
    id: "marketing" as const,
    label: "Marketing",
    icon: "◎",
    description: "Allows us to show relevant promotions on social media to customers who've visited the booking page.",
    required: false,
  },
];

export function CookieOrchestrator() {
  const { openVault } = useLegal();
  const [visible, setVisible] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({ analytics: true, staffPerformance: true, marketing: false });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const save = (state: ConsentState) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    setDismissed(true);
    setTimeout(() => setVisible(false), 600);
  };

  const acceptAll = () => {
    save({ version: CONSENT_VERSION, analytics: true, staffPerformance: true, marketing: true, timestamp: new Date().toISOString() });
  };

  const saveCustom = () => {
    save({ version: CONSENT_VERSION, ...prefs, timestamp: new Date().toISOString() });
  };

  const declineAll = () => {
    save({ version: CONSENT_VERSION, analytics: false, staffPerformance: false, marketing: false, timestamp: new Date().toISOString() });
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[300] w-full max-w-sm"
      style={{
        transform: dismissed ? "translateY(120%) scale(0.95)" : "translateY(0) scale(1)",
        opacity: dismissed ? 0 : hovered ? 1 : 0.92,
        transition: dismissed
          ? "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s ease"
          : "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
        transformOrigin: "bottom right",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Panel */}
      <div
        className="rounded-[2rem] overflow-hidden border"
        style={{
          background: "linear-gradient(145deg, #111 0%, #0a0a0a 60%, #0d0d0d 100%)",
          borderColor: hovered ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.06)",
          boxShadow: hovered
            ? "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.04)"
            : "0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {/* Gold accent line at top */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.6) 40%, rgba(200,160,40,0.4) 60%, transparent)" }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Blade icon */}
              <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600 rotate-45">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600">Digital Fade</p>
                <p className="text-xs font-black uppercase tracking-tight text-white">Cookie Control</p>
              </div>
            </div>
            <button
              onClick={declineAll}
              className="text-white/20 hover:text-white/60 transition-colors text-lg leading-none mt-0.5"
              title="Decline all & close"
            >×</button>
          </div>

          {/* Main copy */}
          <p className="text-[10px] text-white/50 leading-relaxed mb-5 font-medium">
            We use cookies to keep the shop running sharp.{" "}
            <button onClick={() => openVault("privacy")} className="text-red-600 hover:text-red-400 underline underline-offset-2 transition-colors">Privacy Policy</button>
            {" "}·{" "}
            <button onClick={() => openVault("terms")} className="text-red-600 hover:text-red-400 underline underline-offset-2 transition-colors">Terms</button>
          </p>

          {/* Custom accordion */}
          {customising && (
            <div className="mb-5 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
              {categories.map((cat) => (
                <div key={cat.id} className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-red-600/60 text-sm">{cat.icon}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Mini toggle */}
                      <div
                        onClick={(e) => { e.stopPropagation(); setPrefs(p => ({ ...p, [cat.id]: !p[cat.id] })); }}
                        className={`relative w-9 h-5 rounded-full transition-all ${prefs[cat.id] ? "bg-red-600" : "bg-white/10"}`}
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                          style={{
                            left: prefs[cat.id] ? "calc(100% - 1.125rem)" : "0.125rem",
                            transition: "left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                          }}
                        />
                      </div>
                      <span className={`text-[8px] font-black uppercase transition-all ${expanded === cat.id ? "rotate-180" : ""} text-white/20`}>▾</span>
                    </div>
                  </button>
                  {expanded === cat.id && (
                    <div className="px-4 pb-3 pt-1 bg-white/[0.02]">
                      <p className="text-[9px] text-white/40 leading-relaxed">{cat.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { if (customising) saveCustom(); else setCustomising(true); }}
              className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest border border-white/10 rounded-xl text-white/40 hover:border-white/20 hover:text-white/70 transition-all"
            >
              {customising ? "Save Choices" : "Customise"}
            </button>
            <button
              onClick={acceptAll}
              className="flex-[2] py-3 text-[9px] font-black uppercase tracking-widest rounded-xl bg-white text-black hover:bg-red-600 hover:text-white transition-all shadow-lg"
            >
              Accept All
            </button>
          </div>
        </div>

        {/* Brushed-metal texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[2rem] opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.8) 1px, rgba(255,255,255,0.8) 2px)",
            backgroundSize: "4px 100%",
          }}
        />
      </div>
    </div>
  );
}
