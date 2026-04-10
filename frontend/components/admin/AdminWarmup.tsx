"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

/**
 * 🛰️ Administrative Warmup Engine
 * Fires a pre-emptive pulse to wake up the database Cluster as soon as 
 * the operator enters the tactical terminal.
 */
export const AdminWarmup = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    const firePulse = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        
        // Fire-and-forget: Wake up Supabase and heat the BI cache
        syndicateFetch("/api/v1/health/integrity", { 
          headers: { Authorization: `Bearer ${token}` } 
        });
      } catch (e) {
        // Silent failure is acceptable for pre-emptive pulses
      }
    };

    firePulse();
  }, [getToken]);

  return null; // Invisible tactical engine
};
