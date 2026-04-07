"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Dashboard() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600">
      <div className="grain pointer-events-none opacity-20"></div>
      
      {/* Premium Dashboard Header */}
      <nav className="w-full flex justify-center border-b border-white/5 bg-black/50 backdrop-blur-2xl h-20 px-8">
        <div className="w-full max-w-7xl flex justify-between items-center">
          <Link href="/" className="font-black text-white tracking-tighter text-2xl flex items-center gap-2 group">
            <span className="relative">
              GANGSTER<span className="text-red-600">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 hover:text-white transition-all">Back to Site</Link>
            <UserButton />
          </div>
        </div>
      </nav>

      {/* Welcome Section */}
      <main className="max-w-7xl mx-auto px-8 py-20">
        <div className="reveal active">
          <span className="text-red-600 font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">Dashboard</span>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
            Welcome Back<br />
            <span className="gradient-text">{user?.firstName || "GANGSTER"}</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-xl leading-relaxed mb-12">
            Welcome back to the Gangster Barber. Your premium grooming journey continues here. You can now book your next session or manage your appointments.
          </p>
          
          <div className="flex gap-4">
            <Link href="/#booking" className="btn-booking px-10 py-5 text-sm uppercase">
              Book a New Session
            </Link>
          </div>
        </div>

        {/* Placeholder for future features */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-20 filter grayscale">
           <div className="p-8 border border-white/10 rounded-3xl h-48 flex items-center justify-center text-[10px] uppercase tracking-widest font-black">History (Coming Soon)</div>
           <div className="p-8 border border-white/10 rounded-3xl h-48 flex items-center justify-center text-[10px] uppercase tracking-widest font-black">Preferences (Coming Soon)</div>
           <div className="p-8 border border-white/10 rounded-3xl h-48 flex items-center justify-center text-[10px] uppercase tracking-widest font-black">Rewards (Coming Soon)</div>
        </div>
      </main>
    </div>
  );
}
