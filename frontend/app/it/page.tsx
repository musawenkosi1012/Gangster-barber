"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";

export default function ITDashboard() {
  const { getToken } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchITData() {
      try {
        const token = await getToken();
        
        const [healthResp, logsResp] = await Promise.all([
          syndicateFetch("/api/v1/it/system/health", { headers: { Authorization: `Bearer ${token}` } }),
          syndicateFetch("/api/v1/it/security/audit-logs?limit=5", { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (healthResp.ok) setHealth(await healthResp.json());
        if (logsResp.ok) setLogs(await logsResp.json());
      } catch (e) {
        console.error("IT Sync Collision:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchITData();
  }, [getToken]);

  return (
    <div className="space-y-12">
      {/* System Pulse Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-600/5 border border-blue-600/20 p-8 rounded-3xl backdrop-blur-sm">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2 font-mono">DB Connectivity</p>
           <p className="text-4xl font-black tracking-tighter mb-1 font-mono">{health?.database_latency_ms || 0}<span className="text-xs ml-1 opacity-40">MS</span></p>
           <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest italic leading-relaxed">Latency from Harare to AWS Cluster</p>
        </div>
        
        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 font-mono">Engine Status</p>
           <p className="text-4xl font-black tracking-tighter mb-1 font-mono text-emerald-500">{health?.status || "BUSY"}</p>
           <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest italic leading-relaxed">Microservices Heartbeat</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500/50 mb-2 font-mono">Active Incidents</p>
           <p className="text-4xl font-black tracking-tighter mb-1 font-mono">{health?.recent_critical_alerts || 0}</p>
           <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest italic leading-relaxed">Hardware/Security Breaches</p>
        </div>
      </section>

      {/* Forensic Audit Stream */}
      <section className="bg-white/[0.01] border border-white/5 p-8 rounded-[40px] relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white underline decoration-blue-600 decoration-4 underline-offset-4">Recent Audit Stream</h3>
           <button className="text-[9px] font-black uppercase tracking-widest text-blue-500 border border-blue-500/20 px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">View All logs</button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="h-40 bg-white/5 rounded-2xl animate-pulse"></div>
          ) : logs.length === 0 ? (
            <p className="text-white/20 text-[10px] uppercase font-bold text-center py-12">No Administrative actions detected in current cluster cycle.</p>
          ) : (
            <div className="divide-y divide-white/5">
               {logs.map((log) => (
                 <div key={log.id} className="py-5 flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                       <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                       <div>
                          <p className="text-xs font-black uppercase tracking-wider text-white/90 group-hover:text-white">{log.action}</p>
                          <p className="text-[9px] font-bold text-white/20 uppercase mt-1">Actor: {log.actor_id.substring(0, 12)}... • {new Date(log.timestamp).toLocaleTimeString()}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[8px] font-black bg-white/5 px-2 py-1 rounded border border-white/5 text-white/40 uppercase tracking-widest font-mono">
                         ID: {log.id}
                       </span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </section>

      {/* Payment Health heatmap summary placeholder */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="p-8 bg-blue-600/5 border border-blue-600/10 rounded-3xl">
           <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-white/40">Zimbabwe Payment Gateway Health</h4>
           <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 w-[94%]"></div>
              </div>
              <span className="text-[10px] font-black text-emerald-500 font-mono">94% OK</span>
           </div>
           <p className="text-[8px] mt-4 text-white/20 font-bold uppercase tracking-widest leading-relaxed">EcoCash Latency: Nominal • OneMoney: Stable • InnBucks: Ready</p>
         </div>
         
         <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-white/40">Technical Reconciliation</h4>
              <p className="text-sm font-black italic uppercase tracking-tighter">Export Operational Ledger</p>
            </div>
            <button className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-xl">
              Download CSV
            </button>
         </div>
      </section>
    </div>
  );
}
