"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

interface Booking {
  id: number;
  name: string;
  service: string;
  slot_time: string;
  booking_date: string;
  status: string;
  notes: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "border-amber-500/30 bg-amber-500/10 text-amber-500",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  COMPLETED: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  NO_SHOW:   "border-red-600/30 bg-red-600/10 text-red-600",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border whitespace-nowrap ${
      STATUS_STYLES[status] ?? "border-white/10 bg-white/5 text-white/40"
    }`}
  >
    {status}
  </span>
);

const SkeletonCard = () => (
  <div className="h-40 bg-white/[0.02] border border-white/5 rounded-[2rem] animate-pulse" />
);

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSchedule = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
        setHasError(false);
      }
      try {
        const token = await getToken();
        const resp = await syndicateFetch(
          `/api/v1/admin/bookings/schedule?date=${selectedDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const data = await resp.json();
          setBookings(Array.isArray(data) ? data : []);
          setLastUpdated(new Date());
          setHasError(false);
        } else if (!silent) {
          setHasError(true);
        }
      } catch {
        if (!silent) setHasError(true);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedDate, getToken]
  );

  useEffect(() => {
    fetchSchedule(false);

    intervalRef.current = setInterval(() => fetchSchedule(true), 30000);

    const handleVisibility = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
      if (visible) {
        fetchSchedule(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => fetchSchedule(true), 30000);
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchSchedule]);

  const syncLabel = !isTabVisible
    ? "PAUSED"
    : isLoading && bookings.length > 0
    ? "SYNCING..."
    : "ON";

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
            Shop <span className="text-red-600">Floor</span>
          </h1>
          <p className="text-white/20 font-bold uppercase tracking-[0.4em] text-[9px]">
            {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isTabVisible ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
              Auto-Refresh: {syncLabel}
            </span>
          </div>

          {/* Date picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all appearance-none cursor-pointer hover:bg-white/10"
            />
          </div>
        </div>
      </header>

      {/* ── Error State ── */}
      {hasError && !isLoading && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-2xl text-red-600">
            !
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-2">
              Could Not Load Schedule
            </h2>
            <p className="text-white/30 text-xs font-bold max-w-sm">
              The backend at <code className="text-red-500/50">http://localhost:8005</code> could not be reached. 
              Ensure the FastAPI server is running and your <code className="text-red-500/50">.env</code> is configured for local development.
            </p>
          </div>
          <button
            onClick={() => fetchSchedule(false)}
            className="px-8 py-4 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-white/10 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading State ── */}
      {isLoading && bookings.length === 0 && !hasError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && !hasError && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl text-white/20">
            0
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-2 text-white/40">
              No Bookings
            </h2>
            <p className="text-white/20 text-xs font-bold">
              No bookings for {formattedDate}
            </p>
          </div>
        </div>
      )}

      {/* ── Booking Cards ── */}
      {bookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="relative p-6 rounded-[2rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group h-40 flex flex-col justify-between overflow-hidden"
            >
              {/* Accent glow */}
              <div className="absolute -top-4 -right-4 w-16 h-16 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity bg-red-600" />

              {/* Top: time + status */}
              <div className="flex justify-between items-start">
                <span className="text-2xl font-black italic tracking-tighter text-white group-hover:text-red-500 transition-colors">
                  {booking.slot_time}
                </span>
                <StatusBadge status={booking.status} />
              </div>

              {/* Middle: customer + service */}
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-tight text-white line-clamp-1">
                  {booking.name}
                </p>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-600" />
                  {booking.service}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="pt-8 border-t border-white/5 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.4em] text-white/20">
        <p>
          {bookings.length} Booking{bookings.length !== 1 ? "s" : ""} ·{" "}
          {selectedDate}
        </p>
        {lastUpdated && (
          <p>
            Last updated{" "}
            {lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        )}
      </footer>
    </div>
  );
}
