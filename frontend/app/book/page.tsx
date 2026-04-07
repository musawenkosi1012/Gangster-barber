"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { syndicateFetch } from "@/utils/api";

interface Slot {
  time: string;
  available: boolean;
}

export default function BookPage() {
  const { user, isLoaded } = useUser();
  const [bookingStatus, setBookingStatus] = useState<"idle" | "booking" | "success" | "error">("idle");
  const [allocatedSlot, setAllocatedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [bookingMode, setBookingMode] = useState<"automatic" | "custom">("automatic");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    name: "",
    service: "Taper Fade",
  });

  // Sync user name once loaded
  useEffect(() => {
    if (user && !formData.name) {
      setFormData(prev => ({ ...prev, name: `${user.firstName || ""} ${user.lastName || ""}`.trim() }));
    }
  }, [user]);

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      full: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  // Fetch available slots
  const fetchSlots = async () => {
    try {
      const response = await syndicateFetch(`/api/book/slots?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data);
      }
    } catch (err) {
      console.error("Syndicate Slot Fetch Failed:", err);
    }
  };

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingMode === "custom" && !selectedSlot) {
      alert("Please select a slot first");
      return;
    }
    
    setBookingStatus("booking");

    try {
      const response = await syndicateFetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user_id: user?.id || "guest",
          slot_time: bookingMode === "custom" ? selectedSlot : null,
          date: selectedDate,
        }),
      });

      if (!response.ok) throw new Error("Syndicate Booking Failed");
      
      const data = await response.json();
      setAllocatedSlot(data.slot_time);
      setBookingStatus("success");
    } catch (err) {
      console.error(err);
      setBookingStatus("error");
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600">
      <div className="grain pointer-events-none opacity-20"></div>
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-32 md:py-48 flex flex-col items-center">
        <div className="reveal active text-center w-full max-w-2xl mb-16 px-4">
          <span className="text-red-600 font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">Secure My Spot</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-[0.9] uppercase">
            Book Your<br /><span className="gradient-text italic serif normal-case">Session.</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed font-medium">
            Gangster Barber is always in demand. {bookingMode === "automatic" 
              ? "We'll automatically find you the next available slot for your selected date." 
              : "Choose your preferred time from the surgical schedule below."}
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white/5 border border-white/5 rounded-3xl p-6 md:p-12 shadow-2xl backdrop-blur-xl relative z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

          {bookingStatus === "success" ? (
            <div className="text-center py-8 relative z-20">
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-8 text-3xl rotate-12">✓</div>
              <h2 className="text-3xl font-black mb-4 tracking-tighter">SUCCESS!</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                You&apos;ve secured a 40-minute slot for {selectedDate} at:<br />
                <span className="text-white text-6xl font-black tracking-tighter mt-4 block">{allocatedSlot}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard" className="btn-booking py-6 px-12 text-[11px]">Go to Dashboard</Link>
                <Link href="/" className="py-6 px-12 text-[11px] font-bold tracking-widest uppercase border border-white/10 rounded-full hover:bg-white hover:text-black transition-all duration-500">Home</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="flex flex-col gap-10 relative z-20">
              {/* Profile Context */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">The Candidate</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-600 focus:bg-white/10 transition-all font-medium text-sm"
                    placeholder="Candidate Name"
                    required
                  />
                  <div className="relative group">
                    <select 
                      value={formData.service}
                      onChange={(e) => setFormData({...formData, service: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-600 focus:bg-white/10 appearance-none transition-all font-medium text-sm text-white/80"
                    >
                      <option className="bg-[#111]">Taper Fade</option>
                      <option className="bg-[#111]">Lineup & Shape-Up</option>
                      <option className="bg-[#111]">The Full Gangster</option>
                      <option className="bg-[#111]">Beard Sculpt</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover:text-red-600 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Mission Date</label>
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                  {dates.map((d) => (
                    <button
                      key={d.full}
                      type="button"
                      onClick={() => { setSelectedDate(d.full); setSelectedSlot(null); }}
                      className={`flex flex-col items-center justify-center min-w-[70px] py-4 rounded-2xl border transition-all duration-500 ${selectedDate === d.full ? "bg-white text-black border-white shadow-xl scale-105" : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"}`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-tighter mb-1">{d.dayName}</span>
                      <span className="text-lg font-black">{d.dateNum}</span>
                      <span className="text-[8px] font-bold uppercase opacity-60">{d.month}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking Mode Toggle */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Surgical Precision</label>
                <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl gap-1">
                  <button 
                    type="button"
                    onClick={() => { setBookingMode("automatic"); setSelectedSlot(null); }}
                    className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${bookingMode === "automatic" ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"}`}
                  >
                    Automatic Allocation
                  </button>
                  <button 
                    type="button"
                    onClick={() => setBookingMode("custom")}
                    className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${bookingMode === "custom" ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"}`}
                  >
                    Custom Selection
                  </button>
                </div>
              </div>

              {/* Custom Schedule Grid */}
              {bookingMode === "custom" && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Daily Slots</span>
                    <span className="text-[9px] font-medium text-white/30 uppercase italic tracking-wider">40 min sessions</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`
                          py-4 rounded-xl text-[11px] font-bold transition-all duration-300 relative overflow-hidden group border
                          ${!slot.available ? "bg-white/5 text-white/5 border-transparent opacity-30 cursor-not-allowed" : ""}
                          ${selectedSlot === slot.time ? "bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]" : "bg-white/10 hover:bg-white/20 text-white border-white/5 hover:border-white/20"}
                        `}
                      >
                        {slot.time}
                        {slot.available && selectedSlot !== slot.time && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-red-600/0 via-red-600/0 to-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        )}
                      </button>
                    ))}
                  </div>
                  {availableSlots.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-white/20 text-[10px] font-bold uppercase tracking-[.3em]">Loading Schedule...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col gap-4 mt-2">
                <button 
                  disabled={bookingStatus === "booking" || (bookingMode === "custom" && !selectedSlot)}
                  type="submit" 
                  className="btn-booking w-full text-xs flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group"
                >
                  {bookingStatus === "booking" ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Allocating...
                    </span>
                  ) : (
                    <>
                      {bookingMode === "automatic" ? "Secure Quickest Slot" : (!selectedSlot ? "Select a Time Slot" : `Secure ${selectedSlot} Slot`)}
                      <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </>
                  )}
                </button>

                {bookingStatus === "error" && (
                  <p className="text-red-500 text-[9px] text-center font-bold tracking-[.3em] uppercase mt-2 bg-red-500/10 py-3 rounded-xl border border-red-500/20">Extraction Failed: Spot is no longer available.</p>
                )}
              </div>
            </form>
          )}
        </div>
        
        <p className="mt-12 text-white/20 text-[9px] font-bold uppercase tracking-[0.5em] text-center max-w-xs leading-relaxed">
          The Syndicate Elite Series. No refunds on missed appointments.
        </p>
      </main>
    </div>
  );
}
