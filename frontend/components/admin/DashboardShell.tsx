"use client";

import React from "react";
import Link from "next/link";
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
  themeColor: string; // 'red' or 'blue'
  userRole: string;
}

export const DashboardShell = ({ 
  children, 
  title, 
  subtitle, 
  navItems, 
  themeColor,
  userRole 
}: DashboardShellProps) => {
  const accentHex = themeColor === 'blue' ? '#3b82f6' : '#dc2626';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row overflow-x-hidden">
      {/* 🖥️ Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 h-screen flex-col p-8 z-50">
        <div className="mb-16">
          <Link href="/" className="text-2xl font-black tracking-tighter uppercase transition-opacity hover:opacity-80">
            GANGSTER<span style={{ color: accentHex }}>.</span>
          </Link>
          <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em] mt-3">{title}</p>
        </div>

        <nav className="flex-1 flex flex-col gap-1.5">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href} 
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border border-transparent hover:bg-white/[0.03] hover:border-white/5"
            >
              <span 
                className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:scale-125 transition-all"
                style={{ backgroundColor: `var(--accent-hover, ${accentHex}20)` }}
              ></span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-white transition-colors">
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-black" style={{ color: accentHex }}>{userRole[0].toUpperCase()}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] font-black uppercase tracking-widest truncate">{userRole.replace('_', ' ')}</p>
              <p className="text-[7px] text-white/20 font-bold uppercase tracking-[0.2em] mt-1">Authorized</p>
            </div>
          </div>
          
          <SignOutButton><button className="w-full py-4 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-red-600 hover:border-red-600/30 transition-all">Terminate Session</button></SignOutButton>
        </div>
      </aside>

      {/* 📱 Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between p-6 border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-[60]">
        <Link href="/" className="text-lg font-black tracking-tighter uppercase">
          G<span style={{ color: accentHex }}>.</span>BARBER
        </Link>
        <div className="flex items-center gap-4">
          <SignOutButton><button className="text-[8px] font-black uppercase tracking-widest text-red-600/60 px-3 py-1.5 rounded-full bg-red-600/5 border border-red-600/10">Logout</button></SignOutButton>
          <span className="text-[8px] font-black uppercase tracking-widest text-white/30 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            {title.split(' ')[0]}
          </span>
        </div>
      </header>

      {/* 🚀 Main Command Center */}
      <main className="flex-1 min-h-screen relative bg-grid-white/[0.02]">
        <div className="p-6 md:p-12 lg:p-20 max-w-[1600px] mx-auto pb-32 md:pb-20">
          
          <AdminWarmup />
          <IncidentRibbon />

          <header className="mb-12 md:mb-20">
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase leading-none">
              {subtitle}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-4">
               <div className="h-[2px] w-12" style={{ backgroundColor: accentHex }}></div>
               <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[9px] md:text-xs">
                 Security Tier: Elevated • Duty Status: Active
               </p>
            </div>
          </header>
          {children}
        </div>
      </main>

      {/* 📱 Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-3xl border-t border-white/5 flex justify-around items-center p-4 z-[100] safe-area-bottom">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 min-w-[64px]">
             <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
             <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/40">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
