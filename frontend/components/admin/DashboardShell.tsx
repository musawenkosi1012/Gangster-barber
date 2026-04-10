"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IncidentRibbon } from "./IncidentRibbon";
import { AdminWarmup } from "./AdminWarmup";
import { SignOutButton } from "@clerk/nextjs";

interface NavItem {
  label: string;
  href: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  themeColor: string;
  userRole: string;
}

export const DashboardShell = ({
  children,
  title,
  subtitle,
  navItems,
  themeColor,
  userRole,
}: DashboardShellProps) => {
  const accentHex = themeColor === "blue" ? "#3b82f6" : "#dc2626";
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row overflow-x-hidden">

      {/* ══════════ Desktop Sidebar ══════════ */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 h-screen flex-col p-8 z-50">
        <div className="mb-16">
          <Link href="/" className="text-2xl font-black tracking-tighter uppercase transition-opacity hover:opacity-80">
            GANGSTER<span style={{ color: accentHex }}>.</span>
          </Link>
          <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em] mt-3">{title}</p>
        </div>

        <nav className="flex-1 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border ${
                  active
                    ? "bg-white/[0.05] border-white/10"
                    : "border-transparent hover:bg-white/[0.03] hover:border-white/5"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ backgroundColor: active ? accentHex : `${accentHex}30` }}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                    active ? "text-white" : "text-white/30 group-hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
                {active && (
                  <span className="ml-auto w-1 h-5 rounded-full" style={{ backgroundColor: accentHex }} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-black" style={{ color: accentHex }}>
                {userRole[0].toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] font-black uppercase tracking-widest truncate">{userRole.replace("_", " ")}</p>
              <p className="text-[7px] text-white/20 font-bold uppercase tracking-[0.2em] mt-1">Authorized</p>
            </div>
          </div>
          <SignOutButton>
            <button className="w-full py-4 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-red-600 hover:border-red-600/30 transition-all">
              Terminate Session
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* ══════════ Mobile Top Bar ══════════ */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/90 backdrop-blur-xl sticky top-0 z-[200]">
        {/* Logo */}
        <Link href="/" className="text-lg font-black tracking-tighter uppercase">
          GANGSTER<span style={{ color: accentHex }}>.</span>
        </Link>

        {/* Role badge */}
        <span className="text-[8px] font-black uppercase tracking-widest text-white/30 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
          {userRole.replace("_", " ")}
        </span>

        {/* Hamburger */}
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-xl bg-white/5 border border-white/5"
          aria-label="Toggle navigation"
        >
          <span className={`w-5 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileNavOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
          <span className={`w-5 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileNavOpen ? "opacity-0" : ""}`} />
          <span className={`w-5 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileNavOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
        </button>
      </header>

      {/* ══════════ Mobile Nav Drawer ══════════ */}
      <div
        className={`md:hidden fixed inset-0 z-[190] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
        />

        {/* Drawer panel */}
        <div
          className={`absolute top-[65px] left-0 right-0 bg-[#0a0a0a] border-b border-white/5 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            mobileNavOpen ? "translate-y-0" : "-translate-y-4"
          }`}
        >
          {/* Nav links */}
          <nav className="flex flex-col px-4 pt-4 pb-2">
            {navItems.map((item, i) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl mb-1 transition-all duration-300 border ${
                    active
                      ? "bg-white/[0.06] border-white/10"
                      : "border-transparent hover:bg-white/[0.03]"
                  }`}
                  style={{ transitionDelay: mobileNavOpen ? `${i * 40}ms` : "0ms" }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active ? accentHex : `${accentHex}30` }}
                  />
                  <span
                    className={`text-sm font-black uppercase tracking-[0.2em] ${
                      active ? "text-white" : "text-white/40"
                    }`}
                  >
                    {item.label}
                  </span>
                  {active && (
                    <span
                      className="ml-auto text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                      style={{ color: accentHex, backgroundColor: `${accentHex}15` }}
                    >
                      Active
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Divider + Sign out */}
          <div className="px-4 pt-2 pb-6 border-t border-white/5 mt-2">
            <SignOutButton>
              <button className="w-full py-4 rounded-2xl bg-red-600/5 border border-red-600/10 text-[10px] font-black uppercase tracking-[0.3em] text-red-500/70 hover:bg-red-600/10 hover:text-red-400 transition-all">
                Terminate Session
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>

      {/* ══════════ Main Content ══════════ */}
      <main className="flex-1 min-h-screen relative bg-grid-white/[0.02]">
        <div className="p-6 md:p-12 lg:p-20 max-w-[1600px] mx-auto pb-32 md:pb-20">
          <AdminWarmup />
          <IncidentRibbon />

          <header className="mb-12 md:mb-20">
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase leading-none">
              {subtitle}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="h-[2px] w-12" style={{ backgroundColor: accentHex }} />
              <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[9px] md:text-xs">
                Security Tier: Elevated • Duty Status: Active
              </p>
            </div>
          </header>

          {children}
        </div>
      </main>

      {/* ══════════ Mobile Bottom Navigation ══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-3xl border-t border-white/5 flex justify-around items-center px-2 py-3 z-[100]">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 flex-1 py-1"
            >
              <div
                className={`w-6 h-1 rounded-full transition-all duration-300 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
                style={{ backgroundColor: accentHex }}
              />
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  active ? "bg-white/10 border border-white/10" : "bg-transparent"
                }`}
              >
                <span
                  className={`text-[9px] font-black uppercase tracking-tight transition-colors duration-300 ${
                    active ? "text-white" : "text-white/30"
                  }`}
                >
                  {item.label.slice(0, 3)}
                </span>
              </div>
              <span
                className={`text-[7px] font-black uppercase tracking-[0.1em] transition-colors duration-300 ${
                  active ? "text-white" : "text-white/20"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
