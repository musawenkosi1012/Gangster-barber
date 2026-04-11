"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

interface BootstrapData {
  admin_badge: {
    identity: string;
    role: string;
    status: string;
  };
  kpis: {
    revenue: number;
    completed_sessions: number;
    daily_load_pct: number;
    no_show_rate: number;
    next_arrival: {
      name: string;
      service: string;
      time: string;
    };
  };
  schedule_preview: Array<{
    time: string;
    customer: string;
    status: string;
  }>;
  alerts: {
    unresolved_count: number;
    method: string;
    oldest_pending: string;
  };
  integrity: {
    database: string;
    database_latency_ms: number | null;
    auth: string;
    auth_latency_ms: number | null;
    payments: string;
    payments_failures: number;
    payments_success_rate: number | null;
    uptime: number;
    uptime_has_data: boolean;
    cluster: string;
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const KPICard = ({
  label,
  value,
  note,
  colorClass = "bg-white/5",
  noData = false,
  skeleton = false,
}: any) => (
  <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] hover:bg-white/[0.04] transition-all group relative overflow-hidden h-full">
    <div className={`absolute -top-4 -right-4 w-20 h-20 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity ${colorClass}`} />
    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20 mb-6">{label}</p>
    {skeleton ? (
      <>
        <div className="h-12 w-24 bg-white/5 rounded-xl animate-pulse mb-6" />
        <div className="h-3 w-32 bg-white/5 rounded-full animate-pulse" />
      </>
    ) : (
      <>
        <div className="flex items-baseline gap-1">
          <p className={`text-4xl md:text-5xl font-black tracking-tighter italic leading-none truncate ${noData ? "text-white/20" : ""}`}>
            {noData ? "—" : value}
          </p>
        </div>
        <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-6">
          {noData ? "No data for today" : note}
        </p>
      </>
    )}
  </div>
);

const TimelineItem = ({ time, name, service, status }: any) => (
  <div className="flex gap-6 md:gap-10 group animate-in fade-in slide-in-from-left-4 duration-500">
    <div className="flex flex-col items-center">
      <div className="text-[11px] font-black tracking-tighter italic text-white/40 group-hover:text-white transition-colors">
        {time}
      </div>
      <div className="w-[1px] h-full bg-white/5 my-3 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-600 scale-0 group-hover:scale-100 transition-transform" />
      </div>
    </div>
    <div className="flex-1 pb-10">
      <div className="p-6 rounded-3xl border border-white/5 bg-black/40 hover:border-red-600/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest mb-1">{name}</h4>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{service}</p>
        </div>
        <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full border whitespace-nowrap self-start md:self-auto ${
          status === "CONFIRMED"
            ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5"
            : "border-red-600/20 text-red-600 bg-red-600/5"
        }`}>
          {status}
        </span>
      </div>
    </div>
  </div>
);

const HealthRow = ({ label, status, dot, detail }: any) => (
  <div className="flex justify-between items-center group relative cursor-help">
    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">
      {label}
    </span>
    <div className="flex items-center gap-3">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{status}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
    </div>
    <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap z-50 pointer-events-none">
      {detail}
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type FetchState = "loading" | "success" | "error" | "timeout";

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bootstrap = useCallback(
    async (silent = false) => {
      // Abort any in-flight request before starting a new one
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      if (!silent) setFetchState("loading");

      try {
        const token = await getToken();
        const response = await syndicateFetch("/api/v1/admin/dashboard/bootstrap", {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortRef.current.signal,
        });

        if (abortRef.current.signal.aborted) return; // component unmounted

        if (response.ok) {
          const json = await response.json();
          setData(json);
          setFetchState("success");
          setLastUpdated(new Date());
        } else {
          // Got a response but it was an error (401, 403, 500 etc.)
          if (!silent) setFetchState("error");
        }
      } catch (err: any) {
        if (abortRef.current?.signal.aborted) return; // clean unmount

        const isTimeout =
          err.message === "TIMEOUT_EXCEEDED" ||
          err.message?.includes("TIMEOUT") ||
          err.name === "AbortError";

        if (!silent) setFetchState(isTimeout ? "timeout" : "error");
        console.error("[Dashboard] Fetch failed:", err.message);
      }
    },
    [getToken]
  );

  useEffect(() => {
    bootstrap(false);

    // Refresh every 60s silently (don't replace content with skeleton on auto-refresh)
    intervalRef.current = setInterval(() => bootstrap(true), 60000);

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bootstrap]);

  // ── Loading skeleton (first load only) ──
  if (fetchState === "loading" && !data) {
    return (
      <div className="space-y-16 lg:space-y-24 animate-in fade-in duration-500">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {["Today's Revenue", "Daily Load", "No-Show Rate", "Next Arrival"].map((label, i) => (
            <KPICard key={i} label={label} skeleton />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 lg:gap-20">
          <div className="xl:col-span-2 h-96 bg-white/5 rounded-[2.5rem] animate-pulse" />
          <div className="h-96 bg-white/5 rounded-[2.5rem] animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Cold start / timeout screen ──
  if (fetchState === "timeout" && !data) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black">
        <div className="text-center max-w-md animate-in zoom-in-95 duration-700">
          <div className="w-20 h-20 border-t-2 border-red-600 rounded-full animate-spin mx-auto mb-10 shadow-[0_0_50px_rgba(220,38,38,0.2)]" />
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4">System Cold Start</h2>
          <p className="text-sm text-white/40 leading-relaxed mb-10 font-medium">
            The backend server is waking up. This takes a few seconds on the first request of the day.
          </p>
          <button
            onClick={() => bootstrap(false)}
            className="px-10 py-5 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-red-600 hover:text-white transition-all shadow-2xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ── Hard error (no prior data) ──
  if (fetchState === "error" && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">✗</div>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Dashboard Unavailable</h2>
          <p className="text-white/30 text-sm font-bold">The backend could not be reached. Check your connection or try again.</p>
        </div>
        <button
          onClick={() => bootstrap(false)}
          className="px-8 py-4 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-white/10 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Dashboard renders (with or without stale data while refreshing) ──
  const kpis = data?.kpis;
  const hasBookingsToday = data
    ? data.schedule_preview.length > 0 || (kpis?.completed_sessions ?? 0) > 0
    : false;

  // Sync status: show AUTHORIZED when data is loaded, SYNCING when refreshing silently
  const syncLabel =
    fetchState === "loading" && data
      ? "SYNCING..."
      : data
      ? "AUTHORIZED"
      : "OFFLINE";

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* Subtle stale indicator when background refresh is running */}
      {fetchState === "loading" && data && (
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Refreshing dashboard data…
        </div>
      )}

      {/* ── KPI Grid ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        <KPICard
          label="Today's Revenue"
          value={`$${kpis?.revenue ?? 0}`}
          note={`${kpis?.completed_sessions ?? 0} COMPLETED SESSIONS`}
          colorClass="bg-emerald-600"
          noData={!data}
        />
        <KPICard
          label="Daily Load"
          value={`${kpis?.daily_load_pct ?? 0}%`}
          note="ACTIVE CAPACITY"
          colorClass="bg-red-600"
          noData={!data}
        />
        <KPICard
          label="No-Show Rate"
          value={`${kpis?.no_show_rate ?? 0}%`}
          note={hasBookingsToday ? "OPERATIONAL RELIABILITY" : "NO SESSIONS YET TODAY"}
          colorClass="bg-orange-600"
          noData={!data}
        />
        <KPICard
          label="Next Arrival"
          value={kpis?.next_arrival?.time || "—"}
          note={kpis?.next_arrival?.name?.toUpperCase() || "NO CONFIRMED BOOKINGS"}
          colorClass="bg-blue-600"
          noData={!data}
        />
      </section>

      {/* ── Operational Zone ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 lg:gap-20 items-start">

        {/* Flash Schedule */}
        <div className="xl:col-span-2 space-y-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-red-600">Flash Schedule Preview</h3>
            <div className="flex items-center gap-2">
              {data && fetchState !== "error" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span className="text-[10px] font-black text-white/10 uppercase tracking-widest font-mono">
                Live Sync: {syncLabel}
              </span>
            </div>
          </div>

          <div className="relative pl-1">
            {data?.schedule_preview.map((item, idx) => (
              <TimelineItem
                key={idx}
                time={item.time}
                name={item.customer}
                service="Scheduled Service"
                status={item.status}
              />
            ))}

            {(!data || data.schedule_preview.length === 0) && (
              <div className="p-8 rounded-3xl border border-dashed border-white/5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/20 italic">
                  No imminent appointments detected.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts & System Integrity */}
        <aside className="space-y-8">
          {/* Payment Alerts / Ledger Card */}
          {!data ? (
            // Skeleton — never say "loading" in a way that implies something is broken
            <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-4">
              <div className="h-3 w-24 bg-white/5 rounded-full animate-pulse" />
              <div className="h-3 w-40 bg-white/5 rounded-full animate-pulse" />
            </div>
          ) : fetchState === "error" ? (
            // Couldn't reach backend — honest error with retry
            <div className="p-8 rounded-[2.5rem] bg-red-600/5 border border-red-600/20 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-500/60 mb-2">Payment Status</p>
              <p className="text-[8px] font-bold text-white/20">Could not reach ledger</p>
              <button
                onClick={() => bootstrap(false)}
                className="mt-4 px-4 py-2 text-[8px] font-black uppercase tracking-widest text-red-500/60 border border-red-600/20 rounded-xl hover:bg-red-600/10 transition-all"
              >
                Retry
              </button>
            </div>
          ) : data.alerts.unresolved_count > 0 ? (
            <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-red-600/20 to-transparent border border-red-600/30 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Urgent Action Required</h4>
              </div>
              <p className="text-sm font-black italic leading-tight text-red-100/90 mb-8">
                {data.alerts.unresolved_count} payment{data.alerts.unresolved_count > 1 ? "s" : ""} ({data.alerts.method}) awaiting manual verification.
              </p>
              <p className="text-[9px] font-bold text-red-500/50 uppercase tracking-widest mb-4">
                Oldest Pending: {data.alerts.oldest_pending}
              </p>
              <button className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl">
                Open Ledger
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-[2.5rem] bg-emerald-600/5 border border-emerald-500/10 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-500/40">Ledger Clear</p>
              <p className="text-[8px] font-bold text-white/10 mt-2">No unresolved payment transactions.</p>
            </div>
          )}

          {/* System Health Card */}
          <div className="p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20">System Health</h4>
              {lastUpdated && (
                <span className="text-[7px] font-bold text-white/10 uppercase tracking-widest">
                  {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {!data ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 bg-white/5 rounded-full animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <HealthRow
                  label="Database"
                  status={data.integrity.database}
                  detail={data.integrity.database_latency_ms != null ? `${data.integrity.database_latency_ms}ms latency` : "latency unavailable"}
                  dot={
                    data.integrity.database === "operational"
                      ? "bg-emerald-500 animate-pulse"
                      : data.integrity.database === "degraded"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                />
                <HealthRow
                  label="Auth (Clerk)"
                  status={data.integrity.auth}
                  detail={data.integrity.auth_latency_ms != null ? `${data.integrity.auth_latency_ms}ms` : "not measured"}
                  dot={
                    data.integrity.auth === "synced"
                      ? "bg-emerald-500 animate-pulse"
                      : data.integrity.auth === "degraded"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                />
                <HealthRow
                  label="Payment Gateway"
                  status={data.integrity.payments === "no_data" ? "no transactions yet" : data.integrity.payments}
                  detail={data.integrity.payments_success_rate != null ? `${data.integrity.payments_success_rate}% success rate` : "no transaction history"}
                  dot={
                    data.integrity.payments === "operational"
                      ? "bg-emerald-500 animate-pulse"
                      : data.integrity.payments === "no_data"
                      ? "bg-white/20"
                      : data.integrity.payments === "degraded"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                />
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center">
              <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">
                Node: {data?.integrity.cluster ?? "—"}
              </span>
              {data ? (
                data.integrity.uptime_has_data ? (
                  <p className={`text-[8px] font-black uppercase tracking-widest ${
                    data.integrity.uptime < 98 ? "text-amber-500" : "text-emerald-500/60"
                  }`}>
                    Uptime {data.integrity.uptime}% · 30d
                  </p>
                ) : (
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20">
                    Uptime: collecting data…
                  </p>
                )
              ) : (
                <p className="text-[8px] font-black uppercase tracking-widest text-white/20">—</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
