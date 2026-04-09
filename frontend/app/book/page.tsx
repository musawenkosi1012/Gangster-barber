"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { syndicateFetch } from "@/utils/api";
import { useRouter } from "next/navigation";

interface Slot {
  time: string;
  available: boolean;
}

const BOOKING_DEPOSIT = 2;

const PRICES: Record<string, number> = {
  "Taper Fade": 5,
  "Lineup & Shape-Up": 4,
  "The Full Gangster": 8,
  "Beard Sculpt": 4
};

const PAYMENT_LABELS: Record<string, string> = {
  paynow_mobile: "EcoCash",
  paynow_onemoney: "OneMoney",
  paynow_innbucks: "InnBucks",
  paynow_omari: "O'Mari",
  paynow_vmc: "Card",
  paynow_zimswitch: "Zimswitch",
  paynow_web: "Web Pay",
  cash: "Cash"
};

const parseSlotToDate = (dateStr: string, slotStr: string): Date => {
  const match = /(\d+):(\d+)\s*(AM|PM)?/i.exec(slotStr);
  let hours = 0; let mins = 0;
  if(match) {
    hours = Number.parseInt(match[1], 10);
    mins = Number.parseInt(match[2], 10);
    if (match[3]?.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (match[3]?.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hours, mins, 0, 0);
  return target;
};

const isFutureBooking = (b: any): boolean => {
  const bDate = b.booking_date || b.date;
  if (!bDate) return false;
  try {
    const target = parseSlotToDate(bDate, b.slot_time);
    return target.getTime() + (40 * 60 * 1000) > Date.now();
  } catch (e) {
    console.error("Error evaluating future booking:", e);
    return false;
  }
};

const calculateTimeDifference = (targetDate: Date): string => {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "IN PROGRESS...";

  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  
  if (d > 0) {
    return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
};

const buildPaymentPayload = (method: string, bookingId: number, formData: any, user: any, phoneNumber: string) => {
  const email = user?.primaryEmailAddress?.emailAddress || "guest@gangster.com";
  const payload: any = {
    booking_id: bookingId,
    customer_name: formData.name,
    customer_email: email,
    service: formData.service,
    amount: BOOKING_DEPOSIT,
    payment_method: method
  };

  if (method === "mobile" || method === "onemoney" || method === "innbucks" || method === "omari") {
    payload.phone_number = phoneNumber;
  }
  
  // Test tokens for Card/Zimswitch (Sandbox Mode)
  if (method === "vmc") payload.token = "{11111111-1111-1111-1111-111111111111}";
  if (method === "zimswitch") payload.token = "11111111111111111111111111111111";

  return payload;
};

const handlePaynowAction = (payData: any): boolean => {
  if (!payData.success) {
    alert(`Payment Failed: ${payData.error}`);
    return false;
  }

  if (payData.redirect_url) {
    globalThis.window.location.href = payData.redirect_url;
    return true;
  }

  // Handle various Express Checkout instructions
  let message = "Processing Payment...";
  if (payData.authorization_code) {
    message = `InnBucks Code: ${payData.authorization_code}\n\nUse this in your InnBucks app.`;
  } else if (payData.instructions) {
    message = payData.instructions;
  } else if (payData.otpreference) {
    message = `O'Mari OTP Reference: ${payData.otpreference}\nCheck phone for OTP.`;
  }

  alert(message);
  return false;
};

const processPayment = async (paymentMethod: string, user: any, formData: any, bookingId: number, phoneNumber: string): Promise<boolean> => {
  const paynowUrl = process.env.NEXT_PUBLIC_PAYNOW_URL || "http://localhost:8001";
  const method = paymentMethod.replace("paynow_", "");
  const payload = buildPaymentPayload(method, bookingId, formData, user, phoneNumber);

  try {
    const response = await syndicateFetch(`${paynowUrl}/api/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return false;
    
    const payData = await response.json();
    return handlePaynowAction(payData);
  } catch (err) {
    console.error("Payment sync failed:", err);
    return false;
  }
};

const checkActiveBookingUser = async (user: any, setSelectedDate: any, setAllocatedSlot: any, setBookingStatus: any) => {
  try {
    const response = await syndicateFetch(`/api/book/user/${user.id}`);
    if (!response.ok) return;
    const bookings = await response.json();
    const activeBooking = bookings.find(isFutureBooking);
    
    if (activeBooking) {
      setSelectedDate(activeBooking.booking_date || activeBooking.date);
      setAllocatedSlot(activeBooking.slot_time);
      setBookingStatus("success");
    }
  } catch (err) {
    console.warn("No active bookings found or network error.", err);
  }
};

const fetchAvailableSlots = async (selectedDate: string, setAvailableSlots: any) => {
  try {
    const response = await syndicateFetch(`/api/book/slots?date=${selectedDate}`);
    if (!response.ok) return;
    const data = await response.json();
    setAvailableSlots(data);
  } catch (err) {
    console.error("Syndicate Slot Fetch Failed:", err);
  }
};

const startTimerInterval = (selectedDate: string, allocatedSlot: string, setTimeLeft: any) => {
  const updateTimer = () => {
    try {
      const target = parseSlotToDate(selectedDate, allocatedSlot);
      setTimeLeft(calculateTimeDifference(target));
    } catch(e) {
      console.error("Error updating timer:", e);
      setTimeLeft("PENDING");
    }
  };
  
  updateTimer();
  return setInterval(updateTimer, 1000);
};

const getSlotButtonClass = (available: boolean, isSelected: boolean) => {
  const base = "py-4 rounded-xl text-[11px] font-bold transition-all duration-300 relative overflow-hidden group border";
  if (!available) return `${base} bg-black text-white/20 border-white/5 cursor-not-allowed opacity-50 relative`;
  if (isSelected) return `${base} bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]`;
  return `${base} bg-white/10 hover:bg-white/20 text-white border-white/5 hover:border-white/20`;
};

const getPaymentButtonStyle = (method: string, selectedMethod: string) => {
  const base = "flex-1 py-4 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500";
  
  if (method !== selectedMethod) {
    return `${base} text-white/40 hover:text-white`;
  }

  switch (method) {
    case 'paynow_mobile':
      return `${base} bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]`;
    case 'paynow_web':
      return `${base} bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]`;
    case 'cash':
    default:
      return `${base} bg-white text-black shadow-xl`;
  }
};

const BookingSuccessView = ({ selectedDate, allocatedSlot, timeLeft }: { selectedDate: string, allocatedSlot: string, timeLeft: string }) => (
  <div className="text-center py-8 relative z-20">
    <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-8 text-3xl rotate-12">✓</div>
    <h2 className="text-3xl font-black mb-4 tracking-tighter">SUCCESS!</h2>
    <p className="text-gray-400 mb-6 leading-relaxed">
      You&apos;ve secured a 40-minute slot for {selectedDate} at:<br />
      <span className="text-white text-6xl font-black tracking-tighter mt-4 block">{allocatedSlot}</span>
    </p>
    
    <div className="bg-white/5 border border-white/10 rounded-2xl py-4 mb-8">
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 mb-1">Time to Target</p>
       <p className="text-3xl font-black tracking-widest text-white tabular-nums">{timeLeft || "..."}</p>
    </div>

    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link href="/dashboard" className="btn-booking py-6 px-12 text-[11px]">Go to Dashboard</Link>
      <Link href="/" className="py-6 px-12 text-[11px] font-bold tracking-widest uppercase border border-white/10 rounded-full hover:bg-white hover:text-black transition-all duration-500">Home</Link>
    </div>
  </div>
);

const generateNextDates = () => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      full: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' })
    };
  });
};

const ProfileSection = ({ formData, setFormData }: { formData: any, setFormData: any }) => (
  <div className="flex flex-col gap-4">
    <label htmlFor="candidate-name" className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">The Candidate</label>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input 
        id="candidate-name"
        type="text" 
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-600 focus:bg-white/10 transition-all font-medium text-sm"
        placeholder="Candidate Name"
        required
      />
      <div className="relative group">
        <label htmlFor="service-select" className="sr-only">Select Service</label>
        <select 
          id="service-select"
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
);

const DateSelection = ({ dates, selectedDate, setSelectedDate, setSelectedSlot, setBookingMode }: { dates: any[], selectedDate: string, setSelectedDate: any, setSelectedSlot: any, setBookingMode: any }) => (
  <div className="flex flex-col gap-4">
    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Mission Date</span>
    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
      {dates.map((d) => (
        <button
          key={d.full}
          type="button"
          onClick={() => { setSelectedDate(d.full); setSelectedSlot(null); setBookingMode("custom"); }}
          className={`flex flex-col items-center justify-center min-w-[70px] py-4 rounded-2xl border transition-all duration-500 ${selectedDate === d.full ? "bg-white text-black border-white shadow-xl scale-105" : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"}`}
        >
          <span className="text-[9px] font-black uppercase tracking-tighter mb-1">{d.dayName}</span>
          <span className="text-lg font-black">{d.dateNum}</span>
          <span className="text-[8px] font-bold uppercase opacity-60">{d.month}</span>
        </button>
      ))}
    </div>
  </div>
);

const BookingModeToggle = ({ bookingMode, setBookingMode, setSelectedSlot }: { bookingMode: string, setBookingMode: any, setSelectedSlot: any }) => (
  <div className="flex flex-col gap-4">
    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Surgical Precision</span>
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
);

const ScheduleGrid = ({ availableSlots, selectedSlot, setSelectedSlot }: { availableSlots: Slot[], selectedSlot: string | null, setSelectedSlot: any }) => (
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
          className={getSlotButtonClass(slot.available, selectedSlot === slot.time)}
        >
          <span className={slot.available ? "" : "line-through"}>{slot.time}</span>
          {!slot.available && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] tracking-[0.2em] text-red-500 font-extrabold -rotate-12 bg-black/80 px-1 border border-red-500/20 rounded backdrop-blur-sm">BOOKED</span>}
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
);

const PaymentSection = ({ paymentMethod, setPaymentMethod, phoneNumber, setPhoneNumber }: { paymentMethod: string, setPaymentMethod: any, phoneNumber: string, setPhoneNumber: any }) => (
  <div className="flex flex-col gap-4">
    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Capital Transfer</span>
    <div className="grid grid-cols-2 sm:grid-cols-3 p-1 bg-white/5 border border-white/5 rounded-2xl gap-1 overflow-visible">
      {(["paynow_mobile", "paynow_onemoney", "paynow_innbucks", "paynow_omari", "paynow_vmc", "paynow_zimswitch"] as const).map((method) => (
        <button 
          key={method}
          type="button"
          onClick={() => setPaymentMethod(method as any)}
          className={getPaymentButtonStyle(method, paymentMethod)}
        >
          {PAYMENT_LABELS[method]}
        </button>
      ))}
    </div>
    {["paynow_mobile", "paynow_onemoney", "paynow_innbucks", "paynow_omari"].includes(paymentMethod) && (
       <div className="flex flex-col gap-3 mt-6 animate-in fade-in slide-in-from-top-2 duration-500 max-w-sm mx-auto w-full">
         <label htmlFor="phone-number" className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-black text-center">
           {paymentMethod === "paynow_innbucks" ? "Authorization Code" : "Subscriber Account"}
         </label>
         <div className="relative group">
           <input 
              id="phone-number"
              type="text" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="bg-white/[0.03] border border-white/10 rounded-2xl px-8 py-5 outline-none transition-all duration-300 font-black text-lg text-center w-full text-white placeholder:text-white/10 focus:bg-white/[0.08] focus:border-amber-500/60 focus:ring-8 focus:ring-amber-500/5 tracking-[0.1em]"
              placeholder={
                paymentMethod === "paynow_innbucks" ? "000 000" :
                "07.. ... ..."
              }
              required
            />
            <div className="absolute inset-x-12 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
         </div>
         {["paynow_innbucks", "paynow_omari"].includes(paymentMethod) && (
           <div className="flex items-center justify-center gap-2 px-2 mt-1">
             <span className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-pulse" />
             <p className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-bold">
               {paymentMethod === "paynow_innbucks" ? "Check app for code" : "OTP arrival imminent"}
             </p>
           </div>
         )}
       </div>
    )}

    {["paynow_vmc", "paynow_zimswitch", "paynow_web"].includes(paymentMethod) && (
       <div className="flex flex-col items-center gap-4 mt-8 animate-in fade-in zoom-in-95 duration-500 px-6 py-8 bg-white/[0.02] border border-white/5 rounded-3xl max-w-sm mx-auto">
         <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
           <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
         </div>
         <div className="text-center">
            <h3 className="text-white font-black uppercase tracking-widest text-[11px] mb-1">Secure External Gateway</h3>
            <p className="text-white/30 text-[10px] leading-relaxed uppercase tracking-wider font-bold">
              Confirm your booking to be redirected to the <span className="text-white/60">Paynow Secure Portal</span>.
            </p>
         </div>
         <div className="flex gap-2">
           <div className="w-2 h-0.5 bg-amber-500/20 rounded-full"></div>
           <div className="w-8 h-0.5 bg-amber-500/40 rounded-full"></div>
           <div className="w-2 h-0.5 bg-amber-500/20 rounded-full"></div>
         </div>
       </div>
    )}
  </div>
);

const BookingAction = ({ bookingStatus, bookingMode, selectedSlot }: { bookingStatus: string, bookingMode: string, selectedSlot: string | null }) => {
  const getActionLabel = () => {
    if (bookingMode === "automatic") return "Secure Quickest Slot";
    return selectedSlot ? `Secure ${selectedSlot} Slot` : "Select a Time Slot";
  };

  return (
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
            {getActionLabel()}
            <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
          </>
        )}
      </button>

      {bookingStatus === "error" && (
        <p className="text-red-500 text-[9px] text-center font-bold tracking-[.3em] uppercase mt-2 bg-red-500/10 py-3 rounded-xl border border-red-500/20">Extraction Failed: Spot is no longer available.</p>
      )}
    </div>
  );
};

export default function BookPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Route protection bypass for legacy middleware failure
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
  }, [user, isLoaded, router]);

  const [bookingStatus, setBookingStatus] = useState<"idle" | "booking" | "success" | "error">("idle");
  const [allocatedSlot, setAllocatedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [bookingMode, setBookingMode] = useState<"automatic" | "custom">("automatic");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<"paynow_mobile" | "paynow_onemoney" | "paynow_innbucks" | "paynow_omari" | "paynow_vmc" | "paynow_zimswitch">("paynow_mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    service: "Taper Fade",
  });
  // Sync user context and check active bookings
  useEffect(() => {
    if (user) {
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: `${user.firstName || ""} ${user.lastName || ""}`.trim() }));
      }
      checkActiveBookingUser(user, setSelectedDate, setAllocatedSlot, setBookingStatus);
    }
  }, [user]);

  // Fetch available slots
  useEffect(() => {
    fetchAvailableSlots(selectedDate, setAvailableSlots);
    const interval = setInterval(() => fetchAvailableSlots(selectedDate, setAvailableSlots), 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  useEffect(() => {
    if (bookingStatus === "success" && allocatedSlot && selectedDate) {
      const timer = startTimerInterval(selectedDate, allocatedSlot, setTimeLeft);
      return () => clearInterval(timer);
    }
  }, [bookingStatus, allocatedSlot, selectedDate]);

  const handleBooking = async (e: React.FormEvent<HTMLFormElement>) => {
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
      
      // PayNow Integration
      const bookingId = data.id || Math.floor(Math.random() * 100000); // Fallback int if backend doesn't return ID
      const redirected = await processPayment(paymentMethod, user, formData, bookingId, phoneNumber);
      if (redirected) return;

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
            <BookingSuccessView selectedDate={selectedDate} allocatedSlot={allocatedSlot!} timeLeft={timeLeft} />
          ) : (
            <form onSubmit={handleBooking} className="flex flex-col gap-10 relative z-20">
              <ProfileSection formData={formData} setFormData={setFormData} />
              <DateSelection 
                dates={generateNextDates()} 
                selectedDate={selectedDate} 
                setSelectedDate={setSelectedDate} 
                setSelectedSlot={setSelectedSlot} 
                setBookingMode={setBookingMode} 
              />
              <BookingModeToggle 
                bookingMode={bookingMode} 
                setBookingMode={setBookingMode} 
                setSelectedSlot={setSelectedSlot} 
              />
              {bookingMode === "custom" && (
                <ScheduleGrid 
                  availableSlots={availableSlots} 
                  selectedSlot={selectedSlot} 
                  setSelectedSlot={setSelectedSlot} 
                />
              )}
              <PaymentSection 
                paymentMethod={paymentMethod} 
                setPaymentMethod={setPaymentMethod} 
                phoneNumber={phoneNumber} 
                setPhoneNumber={setPhoneNumber} 
              />
              <BookingAction 
                bookingStatus={bookingStatus} 
                bookingMode={bookingMode} 
                selectedSlot={selectedSlot} 
              />
            </form>          )}
        </div>
        
        <p className="mt-12 text-white/20 text-[9px] font-bold uppercase tracking-[0.5em] text-center max-w-xs leading-relaxed">
          The Syndicate Elite Series. No refunds on missed appointments.
        </p>
      </main>
    </div>
  );
}
