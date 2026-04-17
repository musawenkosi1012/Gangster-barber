"use client";

/**
 * /payment-return
 * ───────────────
 * Landing page for Web Pay (redirect-based) payments.
 * PayNow sends the user back here after they complete or cancel payment.
 *
 * Draft-in-cache architecture:
 *   - Before redirect, book/page.tsx stored pendingPaynowRef + pendingSlot + pendingDate
 *     in sessionStorage (no booking ID exists yet — no DB row has been written).
 *   - This page reads pendingPaynowRef and polls GET /api/book/draft-status/{paynowRef}
 *     until the PayNow webhook fires and the backend creates the confirmed booking.
 *   - Once PAID is returned we have the real bookingId and provider_ref to show the user.
 *
 * Legacy fallback:
 *   - If pendingPaynowRef is missing (old flow / direct URL hit) we fall back to
 *     bookingId from URL query param and poll the old /payment-status endpoint.
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { syndicateFetch } from "@/utils/api";

type ReturnStatus = "checking" | "success" | "failed" | "expired" | "error";

// ── Inner component (must be inside Suspense for useSearchParams) ─────────────
function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const [status, setStatus] = useState<ReturnStatus>("checking");
  // The real PayNow reference the customer sees on their phone (e.g. EcoCash receipt)
  const [providerRef, setProviderRef] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    const token = await getToken();

    // ── New flow: draft-based polling by paynow_ref UUID ─────────────────
    const paynowRef =
      typeof window !== "undefined"
        ? sessionStorage.getItem("pendingPaynowRef")
        : null;

    const storedSlot =
      typeof window !== "undefined" ? sessionStorage.getItem("pendingSlot") : null;
    const storedDate =
      typeof window !== "undefined" ? sessionStorage.getItem("pendingDate") : null;

    if (storedSlot) setConfirmedSlot(storedSlot);
    if (storedDate) setConfirmedDate(storedDate);

    if (paynowRef) {
      // Poll draft-status — no booking ID needed
      const maxAttempts = 75;
      let attempts = 0;

      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await syndicateFetch(`/api/book/draft-status/${paynowRef}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();

          if (data.status === "PAID") {
            clearInterval(poll);
            // Booking now exists in DB — show the real PayNow reference
            setProviderRef(data.transactionRef ?? null);
            if (data.slot_time) setConfirmedSlot(data.slot_time);
            if (data.booking_date) setConfirmedDate(data.booking_date);
            // Clear all pending sessionStorage
            sessionStorage.removeItem("pendingPaynowRef");
            sessionStorage.removeItem("pendingDraftToken");
            sessionStorage.removeItem("pendingSlot");
            sessionStorage.removeItem("pendingDate");
            setStatus("success");
            return;
          }

          if (data.status === "REJECTED") {
            clearInterval(poll);
            sessionStorage.removeItem("pendingPaynowRef");
            sessionStorage.removeItem("pendingDraftToken");
            sessionStorage.removeItem("pendingSlot");
            sessionStorage.removeItem("pendingDate");
            setErrorMessage(data.error?.message ?? "Payment was not completed.");
            setStatus("failed");
            return;
          }
        } catch {
          // Network hiccup — keep polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setStatus("expired");
        }
      }, 4000);

      return;
    }

    // ── Legacy fallback: bookingId from URL or old sessionStorage ─────────
    const bookingId =
      searchParams.get("bookingId") ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("pendingBookingId")
        : null);

    if (!bookingId) {
      setStatus("error");
      setErrorMessage("No booking reference found. Please check your dashboard.");
      return;
    }

    const maxAttempts = 75;
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await syndicateFetch(`/api/book/${bookingId}/payment-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.status === "PAID") {
          clearInterval(poll);
          sessionStorage.removeItem("pendingBookingId");
          // transactionRef here is provider_ref (real PayNow ref) or paynow_ref UUID
          setProviderRef(data.transactionRef ?? null);
          setStatus("success");
          return;
        }
        if (data.status === "REJECTED") {
          clearInterval(poll);
          setErrorMessage(data.error?.message ?? "Payment was not completed.");
          setStatus("failed");
          return;
        }
        if (data.status === "EXPIRED") {
          clearInterval(poll);
          setStatus("expired");
          return;
        }
      } catch {
        // keep polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setStatus("expired");
      }
    }, 4000);
  }, [searchParams, getToken]);

  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-10 text-center">

        {/* Checking */}
        {status === "checking" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Verifying Payment</h1>
            <p className="text-white/40 text-sm">Confirming with PayNow — this takes a few seconds.</p>
            {(confirmedSlot || confirmedDate) && (
              <div className="mt-6 bg-white/5 border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Slot being held</p>
                {confirmedSlot && <p className="text-2xl font-black tracking-tighter">{confirmedSlot}</p>}
                {confirmedDate && <p className="text-white/30 text-[10px] mt-1 uppercase tracking-widest">{confirmedDate}</p>}
              </div>
            )}
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl">
              ✅
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Booking Confirmed</h1>
            <p className="text-white/60 text-sm mb-4">Your slot is locked in. See you at the chair.</p>

            {/* Slot summary */}
            {(confirmedSlot || confirmedDate) && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-4">
                {confirmedSlot && (
                  <p className="text-2xl font-black tracking-tighter text-white">{confirmedSlot}</p>
                )}
                {confirmedDate && (
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">{confirmedDate}</p>
                )}
              </div>
            )}

            {/* Payment ref — only show if it's a real PayNow ref (not a UUID) */}
            {providerRef && !providerRef.includes("-") && (
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">
                PayNow Ref: {providerRef}
              </p>
            )}

            <Link
              href="/dashboard"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-colors"
            >
              View My Booking
            </Link>
          </>
        )}

        {/* Failed */}
        {status === "failed" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
              ❌
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Payment Failed</h1>
            <p className="text-white/60 text-sm mb-6">
              {errorMessage ?? "The payment was not completed. No booking was made and no charge was taken."}
            </p>
            <Link
              href="/book"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-colors"
            >
              Try Again
            </Link>
          </>
        )}

        {/* Expired / manual review */}
        {status === "expired" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">
              ⏳
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Still Checking…</h1>
            <p className="text-white/60 text-sm mb-6">
              We couldn&apos;t automatically verify your payment. Our team will check and confirm your booking manually.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-colors"
            >
              View My Booking
            </Link>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Something Went Wrong</h1>
            <p className="text-white/60 text-sm mb-6">{errorMessage ?? "An unexpected error occurred."}</p>
            <Link
              href="/book"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-colors"
            >
              Back to Booking
            </Link>
          </>
        )}

      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function PaymentReturnSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Loading…</h1>
      </div>
    </div>
  );
}

// ── Default export — Suspense wrapper (required for useSearchParams) ──────────
export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<PaymentReturnSkeleton />}>
      <PaymentReturnContent />
    </Suspense>
  );
}
