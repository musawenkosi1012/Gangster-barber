"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useUser, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { syndicateFetch } from "@/utils/api";
import { transformAssetUrl } from "@/utils/cdn";
import { useRouter } from "next/navigation";
import { BRAND } from "@/utils/constants";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceImage { id: number; image_path: string; }
interface Service {
  id: number; name: string; slug: string; price: number;
  duration_minutes: number; description: string | null; images: ServiceImage[];
}
interface Slot { time: string; available: boolean; }
interface Booking {
  id?: number; booking_date?: string; date?: string; slot_time: string;
  status?: string; name?: string; service?: string;
}
interface BookingFormData { name: string; phone: string; service: string; date: string; time: string; }

/** Returned by POST /api/book/ for electronic payments — no DB row yet */
interface DraftTokenResponse {
  draft_token: string;
  slot_time: string;
  booking_date: string;
  expires_at: string;
}

type SlotStatus = "available" | "booked" | "passed" | "selected";

// ── Constants ─────────────────────────────────────────────────────────────────

const BOOKING_DEPOSIT = BRAND.financials.bookingFee;

const PAYMENT_LABELS: Record<string, string> = {
  paynow_mobile: "EcoCash",
  paynow_onemoney: "OneMoney",
  paynow_innbucks: "InnBucks",
  paynow_omari: "O'Mari",
  paynow_web: "Web Pay",
  cash: "Cash",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseSlotToDate = (dateStr: string, slotStr: string): Date => {
  const match = /(\d+):(\d+)\s*(AM|PM)?/i.exec(slotStr);
  let hours = 0, mins = 0;
  if (match) {
    hours = parseInt(match[1], 10);
    mins = parseInt(match[2], 10);
    if (match[3]?.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (match[3]?.toUpperCase() === "AM" && hours === 12) hours = 0;
  }
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hours, mins, 0, 0);
  return target;
};

const isFutureBooking = (b: Booking): boolean => {
  const bDate = b.booking_date || b.date;
  if (!bDate) return false;
  try {
    return parseSlotToDate(bDate, b.slot_time).getTime() + 40 * 60 * 1000 > Date.now();
  } catch { return false; }
};

const calculateTimeDifference = (target: Date): string => {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "IN PROGRESS...";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  if (d > 0) return `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
  return `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
};

const getSlotStatus = (dateStr: string, slotTime: string, isBooked: boolean, selectedSlot: string | null): SlotStatus => {
  if (isBooked) return "booked";
  if (selectedSlot === slotTime) return "selected";
  try {
    const slotStart = parseSlotToDate(dateStr, slotTime);
    if (Date.now() > slotStart.getTime() - 15 * 60 * 1000) return "passed";
  } catch {}
  return "available";
};

const getSlotButtonClass = (status: SlotStatus) => {
  const base = "py-4 rounded-xl text-[11px] font-bold transition-all duration-300 relative overflow-hidden group border h-full flex flex-col items-center justify-center";
  switch (status) {
    case "booked": case "passed":
      return `${base} bg-black text-white/20 border-white/5 cursor-not-allowed opacity-50`;
    case "selected":
      return `${base} bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]`;
    default:
      return `${base} bg-white/10 hover:bg-white/20 text-white border-white/5 hover:border-white/20`;
  }
};

const getPaymentButtonStyle = (method: string, selected: string) => {
  const base = "flex-1 py-4 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500";
  if (method !== selected) return `${base} text-white/40 hover:text-white`;
  switch (method) {
    case "paynow_mobile": return `${base} bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]`;
    case "paynow_web":    return `${base} bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]`;
    default:              return `${base} bg-white text-black shadow-xl`;
  }
};

const buildPaymentInstructions = (payData: Record<string, string>): string | null => {
  if (payData.authorization_code) return `InnBucks Code: ${payData.authorization_code} — Enter this in your InnBucks app.`;
  if (payData.instructions) return payData.instructions;
  if (payData.otpreference) return `O'Mari OTP Reference: ${payData.otpreference} — Check your phone for the OTP.`;
  return null;
};

// ── Static date list (7 days from today) ─────────────────────────────────────

const STATIC_DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    full: d.toISOString().split("T")[0],
    dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
    dateNum: d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short" }),
  };
});

// ── Sub-components ────────────────────────────────────────────────────────────

const BookingSuccessView = ({
  selectedDate, allocatedSlot, timeLeft, images, providerRef,
}: { selectedDate: string; allocatedSlot: string; timeLeft: string; images: ServiceImage[]; providerRef?: string | null; }) => (
  <div className="text-center py-8 relative z-20">
    <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-8 text-3xl rotate-12">✓</div>
    <h2 className="text-2xl font-black mb-4 tracking-tighter uppercase">Slot Secured</h2>
    <p className="text-white/40 mb-6 text-sm uppercase tracking-widest font-bold">
      You are confirmed for {selectedDate} at:<br />
      <span className="text-white text-5xl font-black tracking-tighter mt-4 block">{allocatedSlot}</span>
    </p>
    {images.length > 0 && (
      <div className="flex gap-4 overflow-x-auto pb-8 mb-8 no-scrollbar -mx-12 px-12">
        {images.map((img) => (
          <div key={img.id} className="min-w-[280px] h-48 bg-white/5 rounded-[2rem] border border-white/5 overflow-hidden relative group">
            <Image src={transformAssetUrl(img.image_path)} alt="Gallery" fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        ))}
      </div>
    )}
    <div className="bg-white/5 border border-white/10 rounded-2xl py-4 mb-8">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 mb-1">Time to Target</p>
      <p className="text-3xl font-black tracking-widest text-white tabular-nums">{timeLeft || "..."}</p>
    </div>
    {/* Show real PayNow provider ref — only if it looks like a real ref (not a UUID) */}
    {providerRef && !providerRef.includes("-") && (
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">
        PayNow Ref: {providerRef}
      </p>
    )}
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link href="/dashboard" className="btn-booking py-6 px-12 text-[11px]">Go to Dashboard</Link>
      <Link href="/" className="py-6 px-12 text-[11px] font-bold tracking-widest uppercase border border-white/10 rounded-full hover:bg-white hover:text-black transition-all duration-500 text-white">Home</Link>
    </div>
  </div>
);

const ServiceCatalog = ({
  services, onSelect, selectedService,
}: { services: Service[]; onSelect: (s: Service) => void; selectedService: Service | null; }) => (
  <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center justify-between px-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Select Your Style</span>
      <span className="text-[9px] font-medium text-white/30 uppercase italic">Premium Portfolio</span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {services.map((s) => (
        <button key={s.id} type="button" onClick={() => onSelect(s)}
          className={`group relative h-48 rounded-3xl overflow-hidden border-2 transition-all duration-500 ${
            selectedService?.id === s.id ? "border-amber-500 scale-[1.02]" : "border-white/5 hover:border-white/20"
          }`}
        >
          <div className="absolute inset-0 bg-[#050505]">
            {s.images?.length > 0 ? (
              <Image src={transformAssetUrl(s.images[0].image_path)} alt={s.name} fill
                className="object-cover group-hover:scale-110 transition-transform duration-1000" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-[10px] font-black tracking-[0.6em] text-white/5 uppercase italic">Gangster.</span>
              </div>
            )}
            <div className={`absolute inset-0 transition-opacity duration-500 ${
              selectedService?.id === s.id ? "bg-amber-900/40" : "bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:from-black/70"
            }`} />
          </div>
          <div className="absolute bottom-6 left-6 text-left">
            <h4 className="text-lg font-black uppercase tracking-tighter mb-1">{s.name}</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-amber-500">${s.price}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{s.duration_minutes} MINS</span>
            </div>
          </div>
          {selectedService?.id === s.id && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 text-black rounded-full flex items-center justify-center text-xs">✓</div>
          )}
        </button>
      ))}
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // Booking state machine
  type BookingStatus = "idle" | "booking" | "awaiting_payment" | "verifying" | "payment_failed" | "success" | "error";
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>("idle");

  // Slot / date selection
  const [bookingMode, setBookingMode] = useState<"automatic" | "custom">("automatic");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isServicesLoading, setIsServicesLoading] = useState(true);

  // Form
  const [formData, setFormData] = useState<BookingFormData>({ name: "", phone: "", service: "", date: "", time: "" });
  const [paymentMethod, setPaymentMethod] = useState<"paynow_mobile" | "paynow_onemobile" | "paynow_innbucks" | "paynow_omari" | "paynow_web" | "cash">("paynow_mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [payForCut, setPayForCut] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);

  // Confirmed booking info (populated on success)
  const [allocatedSlot, setAllocatedSlot] = useState<string | null>(null);
  const [confirmedDate, setConfirmedDate] = useState<string>(selectedDate);
  const [confirmedBookingId, setConfirmedBookingId] = useState<number | null>(null);
  const [providerRef, setProviderRef] = useState<string | null>(null); // real PayNow ref shown to user
  const [timeLeft, setTimeLeft] = useState("");

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (isLoaded && !user) router.push("/"); }, [user, isLoaded, router]);

  // Load services
  useEffect(() => {
    (async () => {
      setIsServicesLoading(true);
      try {
        const resp = await syndicateFetch("/api/v1/services");
        if (resp.ok) setServices(await resp.json());
      } catch {}
      finally { setIsServicesLoading(false); }
    })();
  }, []);

  // Pre-fill name from Clerk; check for existing confirmed booking
  useEffect(() => {
    if (!user) return;
    const barberName = (user.unsafeMetadata as Record<string, string>)?.barberName
      || `${user.firstName || ""} ${user.lastName || ""}`.trim();
    if (!formData.name) setFormData(p => ({ ...p, name: barberName }));

    // Check for an already-confirmed future booking
    getToken().then(async (token) => {
      try {
        const resp = await syndicateFetch(`/api/book/user/${user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) return;
        const bookings: Booking[] = await resp.json();
        const active = bookings.find(isFutureBooking);
        if (active) {
          setConfirmedDate(active.booking_date || active.date || selectedDate);
          setAllocatedSlot(active.slot_time);
          setBookingStatus("success");
        }
      } catch {}
    });
  }, [user]);

  // Fetch available slots when date changes
  const fetchSlots = useCallback(async (date: string) => {
    setIsSlotsLoading(true);
    setSlotsError(false);
    try {
      const resp = await syndicateFetch(`/api/book/slots?date=${date}`);
      if (!resp.ok) { setSlotsError(true); return; }
      setAvailableSlots(await resp.json());
    } catch { setSlotsError(true); }
    finally { setIsSlotsLoading(false); }
  }, []);

  useEffect(() => { fetchSlots(selectedDate); }, [selectedDate, fetchSlots]);

  // Countdown timer after success
  useEffect(() => {
    if (bookingStatus !== "success" || !allocatedSlot || !confirmedDate) return;
    const update = () => {
      try { setTimeLeft(calculateTimeDifference(parseSlotToDate(confirmedDate, allocatedSlot))); }
      catch { setTimeLeft("PENDING"); }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [bookingStatus, allocatedSlot, confirmedDate]);

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleBooking = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedService) { setFormError("Select a style first."); return; }
    if (bookingMode === "custom" && !selectedSlot) { setFormError("Select a time slot."); return; }

    setFormError(null);
    setPaymentError(null);
    setPaymentInstructions(null);
    setBookingStatus("booking");

    try {
      const finalService = selectedService.name;
      const payAmount = payForCut
        ? BOOKING_DEPOSIT + (selectedService.price || 0)
        : BOOKING_DEPOSIT;

      const method = paymentMethod.replace("paynow_", "");
      const isCash = paymentMethod === "cash";
      const token = await getToken();

      // ── Generate paynow_ref UUID ──────────────────────────────────────
      // This UUID is used as:
      //   1. The PayNow reference string (what appears on the customer's phone)
      //   2. The draft token key — so the webhook can look it up
      //   3. The polling key — frontend polls /api/book/draft-status/{paynow_ref}
      const paynowRef: string =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // ── Phase 1: Get draft token from backend ─────────────────────────
      // For cash: backend returns a real booking (CONFIRMED immediately).
      // For electronic: backend validates the slot and returns a signed
      //   draft_token — NO booking is written to the DB yet.
      const bookRes = await syndicateFetch("/api/book/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          service: finalService,
          user_id: user?.id || "guest",
          slot_time: bookingMode === "custom" ? selectedSlot : null,
          booking_date: selectedDate,
          payment_method: paymentMethod,
          payment_amount: payAmount,
          paynow_ref: paynowRef,
          poll_url: null,
        }),
      });

      if (!bookRes.ok) {
        const err = await bookRes.json().catch(() => ({}));
        setPaymentError(err.detail || "Could not reserve slot. Please try again.");
        setBookingStatus("idle");
        return;
      }

      const bookData = await bookRes.json();

      // ── Cash path — booking is immediately CONFIRMED ──────────────────
      if (isCash) {
        setConfirmedDate(bookData.booking_date || selectedDate);
        setAllocatedSlot(bookData.slot_time);
        setBookingStatus("success");
        return;
      }

      // ── Electronic path — we have a draft token, no DB row yet ────────
      const { draft_token, slot_time, booking_date: draftDate } = bookData as DraftTokenResponse;

      // Store in sessionStorage so we can resume if the tab is refreshed
      sessionStorage.setItem("pendingPaynowRef", paynowRef);
      sessionStorage.setItem("pendingDraftToken", draft_token);
      sessionStorage.setItem("pendingSlot", slot_time);
      sessionStorage.setItem("pendingDate", draftDate);

      setAllocatedSlot(slot_time);
      setConfirmedDate(draftDate);

      // ── Phase 2: Initiate payment, passing draft_token to PayNow svc ──
      const email = (user as Record<string, any>)?.primaryEmailAddress?.emailAddress || "guest@gangster.com";
      const payRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: paynowRef,     // UUID reference — PayNow stores this
          customer_name: formData.name,
          customer_email: email,
          service: finalService,
          amount: payAmount,
          payment_method: method,
          phone_number: phoneNumber || undefined,
          draft_token,               // Forwarded to webhook → /api/book/confirm
        }),
      });
      const payData = await payRes.json();

      if (!payData.success) {
        // Gateway rejected — clear sessionStorage, let user retry
        sessionStorage.removeItem("pendingPaynowRef");
        sessionStorage.removeItem("pendingDraftToken");
        sessionStorage.removeItem("pendingSlot");
        sessionStorage.removeItem("pendingDate");
        setPaymentError(payData.error || "Payment initiation failed. Please try again.");
        setBookingStatus("idle");
        return;
      }

      // ── Web Pay redirect ──────────────────────────────────────────────
      if (payData.redirect_url) {
        window.location.href = payData.redirect_url;
        return;
      }

      // ── Mobile payment — show instructions + start polling ────────────
      const instructions = buildPaymentInstructions(payData);
      if (instructions) setPaymentInstructions(instructions);
      setBookingStatus("awaiting_payment");

      // Poll /api/book/draft-status/{paynowRef} — no booking ID needed yet.
      // The backend looks up the PaymentTransaction by paynow_ref UUID.
      // Once the webhook fires and creates the booking, this returns PAID
      // with the real bookingId.
      const maxAttempts = 75; // 5 minutes at 4s intervals
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await syndicateFetch(
            `/api/book/draft-status/${paynowRef}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const statusData = await statusRes.json();

          if (statusData.status === "PAID") {
            clearInterval(pollInterval);
            // Booking now exists in DB — store confirmed details
            if (statusData.bookingId) setConfirmedBookingId(statusData.bookingId);
            if (statusData.slot_time) setAllocatedSlot(statusData.slot_time);
            if (statusData.booking_date) setConfirmedDate(statusData.booking_date);
            // transactionRef is provider_ref (real PayNow ref) — show it to user
            if (statusData.transactionRef) setProviderRef(statusData.transactionRef);
            // Clear sessionStorage — booking is real now
            sessionStorage.removeItem("pendingPaynowRef");
            sessionStorage.removeItem("pendingDraftToken");
            sessionStorage.removeItem("pendingSlot");
            sessionStorage.removeItem("pendingDate");
            setBookingStatus("success");
            return;
          }

          if (statusData.status === "REJECTED") {
            clearInterval(pollInterval);
            sessionStorage.removeItem("pendingPaynowRef");
            sessionStorage.removeItem("pendingDraftToken");
            sessionStorage.removeItem("pendingSlot");
            sessionStorage.removeItem("pendingDate");
            setBookingStatus("payment_failed");
            return;
          }
        } catch {
          // Network hiccup — keep polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setBookingStatus("verifying");
        }
      }, 4000);

    } catch (err) {
      console.error("Booking flow error:", err);
      setBookingStatus("error");
    }
  }, [
    selectedService, bookingMode, selectedSlot, payForCut,
    paymentMethod, formData, user, phoneNumber, selectedDate, getToken,
  ]);

  if (!mounted || !isLoaded) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600">
      <div className="grain pointer-events-none opacity-20" />
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 md:px-8 py-32 md:py-48 flex flex-col items-center">
        <div className="reveal active text-center w-full max-w-2xl mb-16 px-4">
          <span className="text-red-600 font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">Secure My Spot</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-[0.9] uppercase">
            Book Your<br /><span className="gradient-text italic serif normal-case">Session.</span>
          </h1>
        </div>

        <div className="w-full max-w-2xl bg-white/5 border border-white/5 rounded-3xl p-6 md:p-12 shadow-2xl backdrop-blur-xl relative z-10 overflow-hidden">

          {/* ── Awaiting Payment ── */}
          {bookingStatus === "awaiting_payment" && (
            <div className="text-center py-12 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Awaiting Payment</h2>
                <p className="text-white/40 text-sm uppercase tracking-widest font-bold">Check your phone and approve the payment prompt</p>
              </div>
              <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-500 mb-1">Your slot is held</p>
                <p className="text-4xl font-black tracking-tighter">{allocatedSlot}</p>
                <p className="text-white/30 text-[10px] mt-2 uppercase tracking-widest">{confirmedDate}</p>
              </div>
              {paymentInstructions && (
                <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 mb-2">Payment Instructions</p>
                  <p className="text-sm font-bold text-white/80 leading-relaxed">{paymentInstructions}</p>
                </div>
              )}
              <p className="text-[9px] text-white/20 uppercase tracking-widest">
                This page updates automatically once payment clears
              </p>
              <p className="text-[8px] text-white/10 uppercase tracking-widest">
                Your booking is confirmed only after payment — the barber is not notified yet
              </p>
            </div>
          )}

          {/* ── Verifying ── */}
          {bookingStatus === "verifying" && (
            <div className="text-center py-12 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">⏳</div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Under Verification</h2>
                <p className="text-white/40 text-sm font-bold leading-relaxed">
                  Payment is being verified by our team.<br />Your slot is held — we&apos;ll confirm shortly.
                </p>
              </div>
              <Link href="/dashboard" className="btn-booking py-5 px-10 text-[11px]">View My Booking</Link>
            </div>
          )}

          {/* ── Payment Failed ── */}
          {bookingStatus === "payment_failed" && (
            <div className="text-center py-12 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">✗</div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Payment Failed</h2>
                <p className="text-white/40 text-sm font-bold">No booking was made. No charge was taken. Try again.</p>
              </div>
              <button onClick={() => setBookingStatus("idle")} className="btn-booking py-5 px-10 text-[11px]">
                Try Again
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {bookingStatus === "success" && (
            <BookingSuccessView
              selectedDate={confirmedDate}
              allocatedSlot={allocatedSlot!}
              timeLeft={timeLeft}
              images={selectedService?.images || []}
              providerRef={providerRef}
            />
          )}

          {/* ── Error ── */}
          {bookingStatus === "error" && (
            <div className="text-center py-12 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">!</div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Something Went Wrong</h2>
                <p className="text-white/40 text-sm font-bold">Please try again or contact support.</p>
              </div>
              <button onClick={() => setBookingStatus("idle")} className="btn-booking py-5 px-10 text-[11px]">
                Try Again
              </button>
            </div>
          )}

          {/* ── Booking Form ── */}
          {(bookingStatus === "idle" || bookingStatus === "booking") && (
            <form onSubmit={handleBooking} className="flex flex-col gap-10">
              {/* Name */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">The Candidate</label>
                <input
                  type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-600 transition-all font-medium text-sm"
                  placeholder="Name" required
                />
              </div>

              {/* Services */}
              {isServicesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-white/5 rounded-3xl border border-white/10" />)}
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/5 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Style Warehouse Offline</p>
                </div>
              ) : (
                <ServiceCatalog services={services} onSelect={setSelectedService} selectedService={selectedService} />
              )}

              {selectedService && (
                <div className="space-y-10 animate-in zoom-in-95 duration-500">
                  {/* Date picker */}
                  <div className="flex flex-col gap-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Mission Date</span>
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                      {STATIC_DATES.map((d) => (
                        <button key={d.full} type="button"
                          onClick={() => { setSelectedDate(d.full); setSelectedSlot(null); }}
                          className={`flex flex-col items-center justify-center min-w-[70px] py-4 rounded-2xl border transition-all duration-500 ${
                            selectedDate === d.full
                              ? "bg-white text-black border-white shadow-xl scale-105"
                              : "bg-white/5 border-white/5 text-white/40"
                          }`}
                        >
                          <span className="text-[9px] font-black uppercase tracking-tighter mb-1">{d.dayName}</span>
                          <span className="text-lg font-black">{d.dateNum}</span>
                          <span className="text-[8px] font-bold uppercase opacity-60">{d.month}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode toggle */}
                  <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl gap-1">
                    {(["automatic", "custom"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setBookingMode(m)}
                        className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          bookingMode === m ? "bg-white text-black" : "text-white/40"
                        }`}
                      >{m}</button>
                    ))}
                  </div>

                  {/* Slot grid (custom mode) */}
                  {bookingMode === "custom" && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.map((s) => {
                        const status = getSlotStatus(selectedDate, s.time, !s.available, selectedSlot);
                        return (
                          <button key={s.time} type="button"
                            disabled={status === "booked" || status === "passed"}
                            onClick={() => setSelectedSlot(s.time)}
                            className={getSlotButtonClass(status)}
                          >
                            <span>{s.time}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Payment section */}
                  <div className="space-y-6">
                    <div className="flex p-5 bg-red-600/10 border border-red-600/20 rounded-2xl">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 leading-relaxed">
                        A ${BOOKING_DEPOSIT} reservation fee is required to secure your slot.
                        The remaining balance can be paid at the shop.
                      </p>
                    </div>

                    {/* Pay for cut checkbox */}
                    <label className="flex items-start gap-4 p-5 bg-white/[0.03] border border-white/10 rounded-2xl cursor-pointer group hover:border-white/20 transition-all duration-300">
                      <div className="relative mt-0.5 shrink-0">
                        <input type="checkbox" className="sr-only" checked={payForCut} onChange={(e) => setPayForCut(e.target.checked)} />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                          payForCut ? "bg-red-600 border-red-600" : "bg-transparent border-white/20 group-hover:border-white/40"
                        }`}>
                          {payForCut && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Also pay for my cut now</span>
                        <span className="text-[9px] font-medium text-white/30 uppercase tracking-widest">
                          Pay ${selectedService.price} service fee upfront — saves time at the shop
                        </span>
                      </div>
                      <span className={`ml-auto text-sm font-black shrink-0 transition-colors duration-300 ${payForCut ? "text-red-500" : "text-white/20"}`}>
                        ${selectedService.price}
                      </span>
                    </label>

                    {/* Price summary */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                        <span>Booking Fee (required)</span>
                        <span className="text-white">${BOOKING_DEPOSIT}</span>
                      </div>
                      {payForCut ? (
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                          <span>Service — {selectedService.name}</span>
                          <span>+ ${selectedService.price}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/20 italic">
                          <span>Service — {selectedService.name}</span>
                          <span>Pay at shop</span>
                        </div>
                      )}
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between text-base font-black uppercase tracking-widest text-white">
                        <span>Total to Pay Now</span>
                        <span className="text-red-600">
                          ${payForCut ? selectedService.price + BOOKING_DEPOSIT : BOOKING_DEPOSIT}
                        </span>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 p-1 bg-white/5 border border-white/5 rounded-2xl gap-1">
                      {(["paynow_mobile", "paynow_onemoney", "paynow_innbucks", "paynow_omari"] as const).map((m) => (
                        <button key={m} type="button"
                          onClick={() => setPaymentMethod(m as any)}
                          className={getPaymentButtonStyle(m, paymentMethod)}
                        >{PAYMENT_LABELS[m]}</button>
                      ))}
                    </div>
                    <p className="text-[8px] font-medium text-center text-white/20 uppercase tracking-widest">Card (VMC) and ZimSwitch coming soon</p>

                    {/* Phone number */}
                    {["paynow_mobile", "paynow_onemoney", "paynow_innbucks", "paynow_omari"].includes(paymentMethod) && (
                      <input
                        type="text" value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-8 py-5 text-lg text-center font-black focus:border-red-600 outline-none transition-all"
                        placeholder="07.. ... ..."
                      />
                    )}
                    <p className="text-[8px] font-medium text-center text-white/20 uppercase tracking-widest">
                      Support: {BRAND.contact.phone} · {BRAND.contact.email}
                    </p>
                  </div>

                  {/* Errors */}
                  {formError && (
                    <div className="flex items-center gap-3 p-4 bg-red-600/10 border border-red-600/30 rounded-2xl">
                      <span className="text-red-500 text-lg">⚠</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-400">{formError}</p>
                    </div>
                  )}
                  {paymentError && (
                    <div className="flex items-center gap-3 p-4 bg-red-600/10 border border-red-600/30 rounded-2xl">
                      <span className="text-red-500 text-lg">✗</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-400">{paymentError}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    disabled={bookingStatus === "booking" || (bookingMode === "custom" && !selectedSlot)}
                    type="submit"
                    className="btn-booking w-full text-xs flex items-center justify-center gap-3"
                  >
                    {bookingStatus === "booking"
                      ? "Processing..."
                      : selectedSlot
                        ? `Secure ${selectedSlot} Slot`
                        : "Confirm & Pay"}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
