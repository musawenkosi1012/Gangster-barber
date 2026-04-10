"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

type SlotStatus = 'available' | 'booked' | 'blocked' | 'passed';

interface Booking {
  id: number;
  name: string;
  service: string;
  slot_time: string;
  status: string;
  notes: string | null;
  payment_method?: string;
  price?: number;
}

// Tactical Chip Component
const StatusChip = ({ status }: { status: SlotStatus }) => {
  const styles = {
    booked: "border-rose-500/50 bg-rose-500/10 text-rose-500",
    available: "border-emerald-500/50 bg-emerald-500/10 text-emerald-500",
    blocked: "border-white/10 bg-white/5 text-white/30",
    passed: "border-zinc-800 bg-zinc-900/50 text-zinc-600",
  };
  return (
    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
};

export default function AdminSchedule() {
  const { getToken } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'booking' | 'slot', data: any } | null>(null);

  const getHarareNow = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Harare" }));
  };

  const getSlotStatus = (dateStr: string, slotTime: string, isBooked: boolean, isBlocked: boolean): SlotStatus => {
    if (isBooked) return 'booked';
    if (isBlocked) return 'blocked';
    const now = getHarareNow();
    const [hours, minutes] = slotTime.split(':').map(Number);
    const slotStart = new Date(dateStr);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 40);
    return slotEnd < now ? 'passed' : 'available';
  };

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const token = await getToken();
      const slotsResp = await syndicateFetch(`/api/book/slots?date=${selectedDate}`);
      const slotsData = await slotsResp.json();
      setSlots(Array.isArray(slotsData) ? slotsData : []);

      const bookingsResp = await syndicateFetch(`/api/v1/admin/bookings/schedule?target_date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (bookingsResp.ok) {
        const bookingsData = await bookingsResp.json();
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      }
    } catch (e) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getToken]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleTransition = async (bookingId: number, status: string) => {
    try {
      const token = await getToken();
      const resp = await syndicateFetch(`/api/v1/admin/bookings/${bookingId}/transition?to_status=${status}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        fetchSchedule();
        setSelectedItem(null);
      }
    } catch (e) {
      alert("Transition failed.");
    }
  };

  const blockSlot = async (slotTime: string, reason: string = "Manual Block") => {
    try {
      const token = await getToken();
      await syndicateFetch("/api/v1/admin/slots/block", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, slot_time: slotTime, reason })
      });
      fetchSchedule();
      setSelectedItem(null);
    } catch (e) {
      alert("Block failed.");
    }
  };

  const unblockSlot = async (blockId: number) => {
    try {
      const token = await getToken();
      await syndicateFetch(`/api/v1/admin/slots/unblock/${blockId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSchedule();
      setSelectedItem(null);
    } catch (e) {
      alert("Unblock failed.");
    }
  };

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto min-h-screen bg-black">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
            Timeline <span className="text-red-600">Controller</span>
          </h1>
          <p className="text-white/20 font-bold uppercase tracking-[0.4em] text-[9px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            Operational Stream • Cluster Sync Active
          </p>
        </div>
        
        <div className="relative group">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all appearance-none cursor-pointer hover:bg-white/10"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
             ▼
          </div>
        </div>
      </header>

      {hasError && (
        <div className="mb-12 p-8 rounded-[2rem] bg-red-600/5 border border-red-600/20 text-center animate-in fade-in slide-in-from-top-4 duration-500">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600">Protocol Disruption</p>
           <p className="text-white/40 text-[10px] mt-2">Operational sync service experienced a tactical failure. Attempting reconnection...</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-44 bg-white/5 rounded-[2rem] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {slots.map((slot) => {
            const booking = bookings.find(b => b.slot_time === slot.time);
            const status = getSlotStatus(selectedDate, slot.time, !!booking, slot.is_blocked);
            
            const baseStyles = "relative p-6 rounded-[2rem] border transition-all duration-300 group h-44 flex flex-col justify-between overflow-hidden cursor-pointer hover:scale-[1.02]";
            
            const variantStyles = {
              booked: "bg-[radial-gradient(circle_at_top_left,#450a0a,#020617)] border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)] active:bg-rose-500/20",
              available: "bg-[radial-gradient(circle_at_top_left,#020617,#020617)] border-white/5 border-dashed hover:border-emerald-500/40 hover:bg-emerald-500/[0.02]",
              blocked: "bg-zinc-950/50 border-white/5 opacity-50",
              passed: "bg-zinc-950 border-white/5 grayscale opacity-30 pointer-events-none"
            };

            return (
              <div 
                key={slot.time} 
                onClick={() => setSelectedItem({ type: booking ? 'booking' : 'slot', data: booking || slot })}
                className={`${baseStyles} ${variantStyles[status]}`}
              >
                {/* Header: Time & Status */}
                <header className="flex justify-between items-start">
                  <span className="text-2xl font-black italic tracking-tighter text-white group-hover:text-red-500 transition-colors">
                    {slot.time}
                  </span>
                  <StatusChip status={status} />
                </header>

                {/* Body: Main Information */}
                <div className="flex-1 flex flex-col justify-center">
                  {booking ? (
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-tight text-white line-clamp-1">{booking.name}</p>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-600"></span>
                        {booking.service}
                      </p>
                    </div>
                  ) : status === 'available' ? (
                    <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                       <span className="text-2xl text-emerald-500/50 font-light">+</span>
                       <p className="text-[8px] font-black uppercase tracking-[0.3em] text-emerald-500/50 -mt-1">Add Walk-in</p>
                    </div>
                  ) : (
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/10 text-center italic">
                      {slot.blocked_reason || (status === 'passed' ? 'Expired' : 'Reserved')}
                    </p>
                  )}
                </div>

                {/* Footer: Metadata & Hints */}
                <footer className="flex justify-between items-end">
                   {booking ? (
                     <div className="flex gap-2">
                        <span className="text-[7px] font-black uppercase bg-white/5 rounded-md px-1.5 py-1 text-white/40 border border-white/5">$15</span>
                        <span className="text-[7px] font-black uppercase bg-white/5 rounded-md px-1.5 py-1 text-white/40 border border-white/5">CASH</span>
                     </div>
                   ) : (
                     <p className="text-[7px] font-black uppercase text-white/10 tracking-[0.2em]">40 MIN Window</p>
                   )}
                   <span className="text-[6px] font-black uppercase text-white/10 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Manage Terminal ⬢
                   </span>
                </footer>
              </div>
            );
          })}
        </div>
      )}

      {/* Tactical Bottom Bar (Quick Stats Placeholder) */}
      <footer className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.4em] text-white/20">
         <div className="flex gap-8">
            <p>Active Slots: {slots.filter(s => s.available).length}</p>
            <p>Load Factor: {Math.round((bookings.length / (slots.length || 1)) * 100)}%</p>
         </div>
         <p>Gangster Barber OS v1.2</p>
      </footer>

      {/* Action Center - Contextual Tactical Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-sm p-10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] scale-in-center overflow-hidden relative">
              
              {/* Decorative Accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>

              {selectedItem.type === 'booking' ? (
                <>
                  <header className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                       <StatusChip status="booked" />
                       <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.3em]">Lifecycle Controller</span>
                    </div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-2">{selectedItem.data.name}</h2>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{selectedItem.data.service} • {selectedItem.data.slot_time}</p>
                  </header>

                  <div className="grid gap-3">
                    <button 
                      onClick={() => handleTransition(selectedItem.data.id, 'COMPLETED')} 
                      className="w-full py-5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all hover:scale-[1.02] active:scale-95"
                    > Complete Mission </button>
                    
                    <button 
                      onClick={() => handleTransition(selectedItem.data.id, 'NO_SHOW')} 
                      className="w-full py-5 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95"
                    > Flag No-Show </button>
                    
                    <button 
                      onClick={() => handleTransition(selectedItem.data.id, 'CANCELLED')} 
                      className="w-full py-5 border border-red-900/40 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all hover:scale-[1.02] active:scale-95"
                    > Terminate Session </button>
                  </div>
                </>
              ) : (
                <>
                  <header className="mb-10 text-center">
                    <div className="flex justify-center mb-6">
                       <span className="text-6xl font-black italic tracking-tighter text-white">{selectedItem.data.time}</span>
                    </div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Capacity Management Module</p>
                  </header>

                  <div className="grid gap-3">
                    {selectedItem.data.is_blocked ? (
                      <button 
                        onClick={() => unblockSlot(selectedItem.data.block_id)} 
                        className="w-full py-5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all active:scale-95"
                      > Release Tactical Block </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => blockSlot(selectedItem.data.time, "Lunch Break")} 
                          className="w-full py-5 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                        > Rest Protocol (Lunch) </button>
                        
                        <button 
                          onClick={() => blockSlot(selectedItem.data.time, "Owner Unavailable")} 
                          className="w-full py-5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                        > Blackout Zone </button>
                      </>
                    )}
                  </div>
                </>
              )}

              <button 
                onClick={() => setSelectedItem(null)} 
                className="w-full mt-10 py-2 text-[8px] font-black uppercase tracking-[0.4em] text-white/10 hover:text-white transition-colors"
              > ⬢ Return to Hub </button>
           </div>
        </div>
      )}

      {/* Animation Definitions (Tailwind v4 doesn't need @keyframes usually but for scale-in we'll use transition) */}
      <style jsx global>{`
        @keyframes scale-in-center {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .scale-in-center {
          animation: scale-in-center 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
      `}</style>
    </div>
  );
}
