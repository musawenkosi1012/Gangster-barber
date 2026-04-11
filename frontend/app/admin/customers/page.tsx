"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

interface Customer {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  clerk_id: string | null;
  status: string;
  total_spend: number | null;
  booking_count: number | null;
  no_show_count: number | null;
  last_visit_at: string | null;
  created_at: string | null;
}

interface CustomerDetail extends Customer {
  reliability_pct: number;
  history: Array<{ date: string; slot: string; status: string; service: string }>;
  notes: string | null;
  tags: string | null;
  favorite_service: string | null;
}

export default function CustomersPage() {
  const { getToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [search, setSearch] = useState("");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // --- 🛰️ List Stream ---
  const fetchList = async () => {
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/customers/?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setCustomers(await response.json());
      }
    } catch (e) {
      console.error("CRM Search Exception:", e);
    } finally {
      setIsListLoading(false);
    }
  };

  // --- 🛰️ Detail Deep-Dive ---
  const fetchDetail = async (id: number) => {
    setIsDetailLoading(true);
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/customers/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setDetail(await response.json());
      }
    } catch (e) {
      console.error("CRM Profile Exception:", e);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [search, getToken]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId, getToken]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-200px)] gap-8">
      
      {/* 📋 Master Panel: The High-Speed Terminal */}
      <div className="w-full lg:w-[400px] flex flex-col gap-6 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6 overflow-hidden">
        <header>
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/30 mb-6">Identity Registry</h2>
          <div className="relative">
            <input 
              type="text"
              placeholder="Fuzzy Search (Name/Phone)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[10px] font-bold tracking-widest uppercase focus:outline-none focus:border-red-600/50 transition-all"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
          {isListLoading ? (
            [...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />)
          ) : customers.length === 0 ? (
             <div className="text-center py-20 opacity-20 text-[10px] font-black uppercase tracking-widest">No customers found</div>
          ) : (
            customers.map((c) => (
              <button 
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full group flex items-center justify-between p-5 rounded-2xl transition-all border ${selectedId === c.id ? 'bg-red-600 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'bg-white/5 border-transparent hover:border-white/10'}`}
              >
                <div className="text-left">
                  <p className={`text-[11px] font-black uppercase tracking-tighter ${selectedId === c.id ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{c.full_name}</p>
                  <p className={`text-[8px] font-bold mt-1 uppercase tracking-widest ${selectedId === c.id ? 'text-white/60' : 'text-white/20'}`}>{c.phone || "No Link"}</p>
                </div>
                <div className={`text-[7px] font-black uppercase tracking-widest py-1.5 px-3 rounded-full ${c.status === 'vip' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'bg-white/10 text-white/40'}`}>
                  {c.status}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 🏢 Detail Workspace: The 360-Degree Profile */}
      <div className="flex-1 min-w-0 bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 overflow-y-auto relative">
        {!selectedId ? (
           <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
              <div className="w-16 h-16 border-2 border-white rounded-full mb-8"></div>
              <p className="text-xs font-black uppercase tracking-[0.5em]">Select Identity to Investigate</p>
           </div>
        ) : isDetailLoading || !detail ? (
           <div className="animate-pulse space-y-12">
              <div className="h-20 bg-white/5 rounded-3xl w-64" />
              <div className="grid grid-cols-3 gap-8">
                 {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-3xl" />)}
              </div>
           </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Identity Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
              <div>
                <div className="flex items-center gap-4 mb-3">
                   <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-sm font-black shadow-2xl">
                     {detail.full_name.split(' ').map(n=>n[0]).join('')}
                   </div>
                   <h1 className="text-3xl font-black italic uppercase tracking-tighter">{detail.full_name}</h1>
                </div>
                <p className="text-xs font-bold text-white/30 uppercase tracking-[0.3em]">{detail.phone} • {detail.id.toString().padStart(6, '0')}</p>
              </div>

              <div className="flex flex-col items-end gap-3 text-right">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Reliability Score</span>
                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" style={{ width: `${detail.reliability_pct}%` }}></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">{detail.reliability_pct}% TRUSTED</p>
              </div>
            </header>

            {/* Tactical Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
               <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">Total LTV</p>
                  <p className="text-3xl font-black text-white">${detail.total_spend ?? 0}</p>
                  <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mt-2">{detail.booking_count ?? 0} Lifetime Sessions</p>
               </div>
               <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">Risk Profile</p>
                  <p className={`text-3xl font-black ${(detail.no_show_count ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{detail.no_show_count ?? 0} No-Shows</p>
                  <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mt-2">Historical Integrity</p>
               </div>
               <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">Preferred Style</p>
                  <p className="text-xl font-black text-white uppercase italic tracking-tighter">{detail.favorite_service || "N/A"}</p>
                  <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mt-2">Frequent Request</p>
               </div>
            </div>

            {/* Tactical Timeline: History */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 mb-8 flex items-center gap-4">
                 <span className="h-px flex-1 bg-white/5"></span>
                 Session History
                 <span className="h-px flex-1 bg-white/5"></span>
              </h3>
              
              <div className="space-y-4">
                {detail.history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.05] transition-all">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{h.service}</p>
                      <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">{h.date} • {h.slot}</p>
                    </div>
                    <div className={`text-[7px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full ${h.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' : h.status === 'NO_SHOW' ? 'bg-red-500/10 text-red-500 border border-red-500/10' : 'bg-white/5 text-white/30'}`}>
                      {h.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Quick Actions */}
            <div className="mt-20 flex flex-wrap gap-4">
               <button className="px-8 py-5 bg-white text-black text-[9px] font-black uppercase tracking-[0.3em] rounded-full hover:bg-red-600 hover:text-white transition-all shadow-xl">
                  New Appointment
               </button>
               <button className="px-8 py-5 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-[0.3em] rounded-full border border-white/5 hover:border-red-600 hover:text-red-600 transition-all">
                  Block Identity
               </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
