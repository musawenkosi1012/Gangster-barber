"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";
import Link from "next/link";

interface Notification {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  action_url: string | null;
}

export const IncidentRibbon = () => {
  const { getToken, isLoaded } = useAuth();
  const [incidents, setIncidents] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    // Only fetch if Clerk is ready
    if (!isLoaded) return;
    
    try {
      const token = await getToken();
      if (!token) return;

      const response = await syndicateFetch("/api/v1/admin/notifications/critical", {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIncidents(data);
      } else if (response.status === 401 || response.status === 403) {
        console.error("[Syndicate] Security Verification Failed: Access Denied to Operational Stream.");
      }
    } catch (e) {
      console.error("Incident Sync Failed");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isLoaded]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 300000); // 5-minute tactical refresh
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  if (isLoading) {
    return (
      <div className="mb-8 w-full h-16 rounded-2xl bg-white/5 border border-white/5 animate-pulse flex items-center px-8">
         <div className="w-2 h-2 rounded-full bg-white/10"></div>
         <div className="ml-6 w-32 h-2 bg-white/10 rounded-full"></div>
      </div>
    );
  }

  if (incidents.length === 0) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-6 px-6 py-4">
        {/* Pulsing Alert Icon */}
        <div className="relative flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping absolute inset-0"></div>
          <div className="w-2 h-2 rounded-full bg-amber-500 relative"></div>
        </div>

        {/* Tactical Information Controller */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block flex items-center gap-2">
                 <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                 {incidents[0].title}
              </span>
              <p className="text-xs font-medium text-amber-100/80 truncate">
                {incidents[0].message}
              </p>
            </div>
            
            <Link 
              href={incidents[0].action_url || "/admin/ledger"}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all active:scale-95 ease-out duration-200"
            >
              Resolve Item
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
