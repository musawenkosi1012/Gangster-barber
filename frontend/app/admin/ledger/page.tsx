"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

interface Transaction {
  id: number;
  provider: string;
  provider_ref: string;
  status: string;
  amount: number;
  created_at: string;
  booking_id: number | null;
}

export default function AdminLedger() {
  const { getToken } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [matchingBookingId, setMatchingBookingId] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/ledger?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setTransactions(await response.json());
      }
    } catch (e) {
      console.error("Ledger Sync Failure");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, search]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleMatch = async () => {
    if (!selectedTx || !matchingBookingId) return;
    setIsMatching(true);
    setMatchError(null);
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/ledger/${selectedTx.id}/match?booking_id=${matchingBookingId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setSelectedTx(null);
        setMatchingBookingId("");
        fetchLedger();
      } else {
        setMatchError("Match failed — check the booking ID and try again.");
      }
    } catch (e) {
      setMatchError("Connection error. Try again.");
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      
      {/* 🔍 Search & Filter Strip */}
      <section className="flex flex-col md:flex-row gap-6 items-end justify-between">
         <div className="w-full max-w-xl group">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-3 group-hover:text-red-600 transition-colors">Forensic Search</p>
            <input 
              type="text" 
              placeholder="Filter by Reference Code (EcoCash/OneMoney)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 focus:bg-white/[0.05] transition-all"
            />
         </div>

         <div className="flex gap-3">
            <button className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Manual Review Only</button>
            <button className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Export CSV</button>
         </div>
      </section>

      {/* 📊 High-Density Transaction Table */}
      <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20">Ref Code</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20">Provider</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20">Amount</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20">Status</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20">Timeline</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/20 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="group hover:bg-white/[0.01] transition-colors">
                       <td className="px-8 py-6">
                          <code className="text-xs font-black tracking-tighter italic text-white group-hover:text-red-500 transition-colors">{tx.provider_ref || 'NO REF'}</code>
                       </td>
                       <td className="px-8 py-6">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{tx.provider}</span>
                       </td>
                       <td className="px-8 py-6">
                          <span className="text-xs font-black italic">${tx.amount.toFixed(2)}</span>
                       </td>
                       <td className="px-8 py-6">
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${
                            tx.status === 'completed' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 
                            tx.status === 'manual_review' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' : 
                            'border-white/10 text-white/20'
                          }`}>
                            {tx.status.replace('_', ' ')}
                          </span>
                       </td>
                       <td className="px-8 py-6">
                          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                            {new Date(tx.created_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          {tx.status === 'manual_review' ? (
                            <button 
                              onClick={() => setSelectedTx(tx)}
                              className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-500"
                            > ⬢ Recon Match </button>
                          ) : tx.booking_id ? (
                            <span className="text-[8px] font-black uppercase text-white/10">Matched #{tx.booking_id}</span>
                          ) : (
                            <span className="text-[8px] font-black uppercase text-white/5">—</span>
                          )}
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </section>

      {/* 📦 Reconciliation Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-6 bg-black/90 backdrop-blur-md animate-in fade-in slide-in-from-right-12 duration-500">
           <div className="bg-[#0a0a0a] border-l border-white/10 w-full max-w-xl h-full p-12 overflow-y-auto">
              <header className="mb-12">
                 <button onClick={() => { setSelectedTx(null); setMatchError(null); }} className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white mb-8 flex items-center gap-2">
                    ← Close Terminal
                 </button>
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Financial Reconciliation</p>
                 <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Manual Match</h2>
              </header>

              <div className="space-y-12">
                 <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Reference Meta</p>
                    <div className="grid grid-cols-2 gap-8">
                       <div>
                          <p className="text-xs font-black italic text-white mb-0.5">{selectedTx.provider_ref}</p>
                          <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Ref Code</p>
                       </div>
                       <div>
                          <p className="text-xs font-black italic text-white mb-0.5">${selectedTx.amount}</p>
                          <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Amount</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                       <label className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-3 block">Target Booking ID</label>
                       <input 
                         type="number" 
                         placeholder="Enter Booking ID (e.g. 552)..."
                         value={matchingBookingId}
                         onChange={(e) => setMatchingBookingId(e.target.value)}
                         className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500 transition-all"
                       />
                       <p className="mt-4 text-[9px] font-medium text-white/40">Enter the Booking ID provided by the customer or found in the Schedule view.</p>
                    </div>

                    {matchError && (
                      <div className="flex items-center gap-3 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl">
                        <span className="text-red-500 text-sm">✗</span>
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{matchError}</span>
                      </div>
                    )}
                    <button
                      onClick={handleMatch}
                      disabled={isMatching || !matchingBookingId}
                      className="w-full py-5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      {isMatching ? 'Processing Sync...' : 'Authorize & Match Transaction'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
