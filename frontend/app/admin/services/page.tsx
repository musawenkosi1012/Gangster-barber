"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";
import Image from "next/image";

interface Service {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  description: string | null;
}

export default function AdminServices() {
  const { getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<Service>>({
    name: "",
    price: 0,
    duration_minutes: 40,
    is_active: true,
    sort_order: 0,
    description: ""
  });

  const fetchServices = async () => {
    try {
      const token = await getToken();
      const response = await syndicateFetch("/api/v1/admin/services", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setServices(await response.json());
      }
    } catch (e) {
      console.error("Service Inventory Sync Failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSave = async () => {
    try {
      const token = await getToken();
      const method = currentService.id ? "PATCH" : "POST";
      const url = currentService.id 
        ? `/api/v1/admin/services/${currentService.id}` 
        : "/api/v1/admin/services";

      const response = await syndicateFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(currentService)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchServices();
      }
    } catch (e) {
      alert("Failed to save service inventory.");
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
         <div>
            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] mb-3">Service Catalog</p>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Inventory Control</h2>
         </div>
         <button 
           onClick={() => {
             setCurrentService({ name: "", price: 0, duration_minutes: 40, is_active: true, sort_order: 0 });
             setIsModalOpen(true);
           }}
           className="px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl"
         >
           + Add New Service
         </button>
      </header>

      {/* 🖼️ Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {services.map((service) => (
          <div key={service.id} className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden hover:bg-white/[0.04] transition-all">
             <div className="aspect-[16/10] bg-white/5 relative overflow-hidden">
                {service.image_url ? (
                  <Image 
                    src={service.image_url} 
                    alt={service.name} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-12">
                     <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/5 opacity-40">GANGSTER.</p>
                  </div>
                )}
                {!service.is_active && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                     <span className="px-4 py-2 border border-white/20 rounded-full text-[8px] font-black uppercase tracking-widest text-white/40 italic">Draft / Hidden</span>
                  </div>
                )}
             </div>
             
             <div className="p-8">
                <div className="flex justify-between items-start mb-4">
                   <h4 className="text-lg font-black uppercase tracking-widest">{service.name}</h4>
                   <span className="text-sm font-black italic text-red-600">${service.price}</span>
                </div>
                <div className="flex gap-4 items-center">
                   <span className="text-[8px] font-black uppercase tracking-widest text-white/20 italic">{service.duration_minutes} MINS</span>
                   <div className="h-[1px] flex-1 bg-white/5"></div>
                   <button 
                     onClick={() => {
                       setCurrentService(service);
                       setIsModalOpen(true);
                     }}
                     className="text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white"
                   > Edit Intel </button>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* 🗳️ Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
           <div className="bg-[#050505] border border-white/10 w-full max-w-2xl rounded-[3rem] p-12 shadow-[0_0_100px_rgba(220,38,38,0.1)] overflow-y-auto max-h-[90vh]">
              <header className="mb-10">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Service Data Terminal</p>
                 <h3 className="text-3xl font-black italic uppercase tracking-tighter italic">Edit Service Details</h3>
              </header>

              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Service Name</label>
                       <input 
                         type="text" 
                         value={currentService.name}
                         onChange={(e) => setCurrentService({ ...currentService, name: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Price ($ USD)</label>
                       <input 
                         type="number" 
                         value={currentService.price}
                         onChange={(e) => setCurrentService({ ...currentService, price: parseFloat(e.target.value) })}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Image URL (Assets)</label>
                    <input 
                      type="text" 
                      value={currentService.image_url || ""}
                      onChange={(e) => setCurrentService({ ...currentService, image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[10px] font-bold text-white/40 outline-none focus:border-red-600 transition-all"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Duration (Minutes)</label>
                       <select 
                         value={currentService.duration_minutes}
                         onChange={(e) => setCurrentService({ ...currentService, duration_minutes: parseInt(e.target.value) })}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none"
                       >
                         <option value={40}>40 Mins (1 Slot)</option>
                         <option value={80}>80 Mins (2 Slots)</option>
                         <option value={120}>120 Mins (3 Slots)</option>
                       </select>
                    </div>
                    <div className="space-y-3 flex flex-col justify-center">
                       <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">Visibility</label>
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setCurrentService({...currentService, is_active: !currentService.is_active})}
                            className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                              currentService.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-white/20 border border-white/10'
                            }`}
                          >
                            {currentService.is_active ? 'Public Catalog' : 'Hidden Draft'}
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-8">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-5 border border-white/10 text-white/20 text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-white/5 transition-all"
                    > Discard </button>
                    <button 
                      onClick={handleSave}
                      className="flex-[2] py-5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-red-500 transition-all shadow-[0_10px_40px_rgba(220,38,38,0.3)]"
                    > Commit Inventory Change </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
