"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { syndicateFetch } from "@/utils/api";
import { transformAssetUrl } from "@/utils/cdn";
import Image from "next/image";

interface ServiceImage {
  id: number;
  image_path: string;
  alt_text: string | null;
}

interface Service {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  images: ServiceImage[];
  is_active: boolean;
  sort_order: number;
  description: string | null;
}

export default function AdminServices() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  
  // ⚡ Logic Jitter Protection: Memoize the view loop
  const serviceList = useMemo(() => services, [services]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless hard limit
  const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const isOverLimit = totalFileSize > MAX_UPLOAD_BYTES;
  const [currentService, setCurrentService] = useState<Partial<Service>>({
    name: "",
    price: 0,
    duration_minutes: 40,
    is_active: true,
    sort_order: 0,
    description: "",
    images: []
  });

  const fetchServices = async () => {
    if (!isLoaded || !isSignedIn) return;
    
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
    if (isLoaded && isSignedIn) fetchServices();
  }, [isLoaded, isSignedIn]);

  const handleSave = async () => {
    setSaveError(null);

    if (isOverLimit) {
      setSaveError(`Images too large — ${(totalFileSize / 1024 / 1024).toFixed(1)}MB selected, max 4MB. Remove some images and try again.`);
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();
      const method = currentService.id ? "PATCH" : "POST";
      const url = currentService.id
        ? `/api/v1/admin/services/${currentService.id}`
        : "/api/v1/admin/services";

      const formData = new FormData();

      if (currentService.name) formData.append("name", currentService.name);
      if (currentService.price !== undefined) formData.append("price", currentService.price.toString());
      if (currentService.duration_minutes !== undefined) formData.append("duration_minutes", currentService.duration_minutes.toString());
      if (currentService.description) formData.append("description", currentService.description || "");
      if (currentService.is_active !== undefined) formData.append("is_active", currentService.is_active.toString());
      if (currentService.sort_order !== undefined) formData.append("sort_order", currentService.sort_order.toString());

      selectedFiles.forEach(file => formData.append("files", file));

      // Use 60s timeout for uploads — image processing is slow on cold starts
      const response = await syndicateFetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      }, 2, 60000);

      if (response.ok) {
        setIsModalOpen(false);
        setSelectedFiles([]);
        setSaveError(null);
        fetchServices();
      } else if (response.status === 413) {
        setSaveError("Server rejected the upload — images too large. Keep total under 4MB.");
      } else {
        setSaveError("Save failed. Check your connection and try again.");
      }
    } catch (e) {
       console.error("Save failed:", e);
       setSaveError("Upload timed out. Try fewer or smaller images.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!confirm("Permanently delete this service? This cannot be undone.")) return;
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/services/${serviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchServices();
      }
    } catch (e) {
      console.error("Service decommission failed:", e);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm("Are you sure you want to remove this asset?")) return;
    try {
      const token = await getToken();
      const response = await syndicateFetch(`/api/v1/admin/services/images/${imageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        // Optimistic UI: Filter out the image locally
        if (currentService.images) {
          setCurrentService({
            ...currentService,
            images: currentService.images.filter(img => img.id !== imageId)
          });
        }
      }
    } catch (e) {
      console.error("Asset decommission failed:", e);
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
        {serviceList.map((service) => (
          <div key={service.id} className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden hover:bg-white/[0.04] transition-all">
             <div className="aspect-[16/10] bg-white/5 relative overflow-hidden">
                {service.images && service.images.length > 0 ? (
                  <Image 
                    src={transformAssetUrl(service.images[0].image_path)} 
                    alt={service.name} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-12 bg-[#050505]">
                     <div className="flex flex-col items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 italic">GANGSTER.</p>
                        <p className="text-[7px] font-bold uppercase tracking-widest text-red-600/20">Awaiting Portfolio Assets</p>
                     </div>
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

                  {/* Operational Asset Hub */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Service Assets & Portfolio (Upload Only)</label>
                    <div className="flex gap-4">
                      <input 
                        type="file" 
                        multiple 
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files) setSelectedFiles(Array.from(e.target.files));
                        }}
                        className="hidden" 
                        accept="image/*"
                      />
                      
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-red-600 transition-colors">
                          {selectedFiles.length > 0 ? "Change" : "Add Gallery Files"}
                        </span>
                      </button>
                    </div>
                    
                    {selectedFiles.length > 0 && (
                      <div className={`flex items-center gap-3 p-4 border rounded-2xl animate-in slide-in-from-left-2 duration-300 ${
                        isOverLimit
                          ? "bg-orange-600/15 border-orange-500/40"
                          : "bg-red-600/10 border-red-600/20"
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOverLimit ? "bg-orange-500" : "bg-red-600 animate-pulse"}`} />
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isOverLimit ? "text-orange-400" : "text-red-600"}`}>
                            Staged: {selectedFiles.length} {selectedFiles.length === 1 ? "Asset" : "Assets"} — {(totalFileSize / 1024 / 1024).toFixed(2)}MB / 4MB
                          </span>
                          {isOverLimit && (
                            <span className="text-[8px] font-bold text-orange-400/80 uppercase tracking-widest">
                              ⚠ Too large — remove files to proceed
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { setSelectedFiles([]); setSaveError(null); }}
                          className="ml-auto text-[8px] font-black text-white/20 hover:text-white uppercase tracking-widest"
                        > Clear </button>
                      </div>
                    )}
                    
                    {/* Strategic Asset Grid: Resilience pattern for multi-asset drift */}
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {currentService.images?.map(img => {
                        const imgSrc = img.image_path.startsWith('http') 
                          ? img.image_path 
                          : `/${img.image_path}`;
                        
                        return (
                          <div key={img.id} className="group/img aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/5 relative">
                            <Image 
                              src={transformAssetUrl(img.image_path, 200, 200)} 
                              alt="Gallery Preview" 
                              width={100} 
                              height={100} 
                              className="object-cover w-full h-full"
                              unoptimized={true}
                            />
                            <button 
                              type="button"
                              onClick={() => handleDeleteImage(img.id)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                            >
                              <span className="text-[10px] text-white">×</span>
                            </button>
                          </div>
                        );
                      }) || <span className="text-[10px] font-black uppercase tracking-widest text-white/10 italic">No Assets Staging</span>}
                    </div>
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

                 {/* Error banner */}
                 {saveError && (
                   <div className="flex items-start gap-3 p-5 bg-orange-600/10 border border-orange-500/30 rounded-2xl animate-in slide-in-from-bottom-2 duration-300">
                     <span className="text-orange-400 text-sm leading-none mt-0.5">⚠</span>
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">Upload Failed</span>
                       <span className="text-[9px] text-orange-300/80 leading-relaxed">{saveError}</span>
                     </div>
                     <button onClick={() => setSaveError(null)} className="ml-auto text-orange-400/40 hover:text-orange-400 text-sm leading-none">×</button>
                   </div>
                 )}

                 <div className="flex gap-4 pt-8">
                    {currentService.id && (
                      <button
                        onClick={() => handleDeleteService(currentService.id!)}
                        className="px-6 py-5 border border-red-600/30 text-red-600/60 text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-red-600/10 hover:text-red-500 transition-all"
                      > Delete </button>
                    )}
                    <button
                      onClick={() => { setIsModalOpen(false); setSaveError(null); }}
                      className="flex-1 py-5 border border-white/10 text-white/20 text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-white/5 transition-all"
                    > Discard </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || isOverLimit}
                      className={`flex-[2] py-5 text-[10px] font-black uppercase tracking-widest rounded-3xl transition-all ${
                        isOverLimit
                          ? "bg-orange-600/20 text-orange-400/60 border border-orange-500/20 cursor-not-allowed"
                          : isSaving
                          ? "bg-red-600/50 text-white/50 cursor-not-allowed"
                          : "bg-red-600 text-white hover:bg-red-500 shadow-[0_10px_40px_rgba(220,38,38,0.3)]"
                      }`}
                    >
                      {isSaving ? "Uploading..." : isOverLimit ? "⚠ Images Too Large" : "Commit Inventory Change"}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
