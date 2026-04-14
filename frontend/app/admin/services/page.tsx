"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
  booking_fee: number | null;
  duration_minutes: number;
  images: ServiceImage[];
  is_active: boolean;
  sort_order: number;
  description: string | null;
}

// ─── Inline editable field ───────────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  prefix = "",
  type = "text",
  className = "",
}: {
  value: string | number;
  onSave: (v: string) => void;
  prefix?: string;
  type?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== String(value)) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
        className={`bg-white/10 border border-red-600/60 rounded-lg px-2 py-0.5 outline-none text-white ${className}`}
        style={{ minWidth: 60, maxWidth: 160 }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="Click to edit"
      className={`cursor-pointer border-b border-dashed border-white/20 hover:border-red-600 transition-colors group ${className}`}
    >
      {prefix}{value}
      <span className="ml-1 opacity-0 group-hover:opacity-40 text-[8px] transition-opacity">✎</span>
    </span>
  );
}

// ─── 3D Image Gallery ─────────────────────────────────────────────────────────
function Gallery3D({ images, serviceName }: { images: ServiceImage[]; serviceName: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 → +0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setStyle({
        transform: `perspective(600px) rotateY(${x * 22}deg) rotateX(${-y * 18}deg) scale3d(1.04,1.04,1.04)`,
        transition: "transform 0.08s linear",
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStyle({ transform: "perspective(600px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)", transition: "transform 0.5s ease" });
  }, []);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[16/10] bg-[#050505] flex items-center justify-center rounded-[1.5rem] overflow-hidden">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 italic">GANGSTER.</p>
          <p className="text-[7px] font-bold uppercase tracking-widest text-red-600/20">Awaiting Portfolio Assets</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="aspect-[16/10] relative rounded-[1.5rem] overflow-hidden cursor-crosshair"
      style={{ transformStyle: "preserve-3d", willChange: "transform", ...style }}
    >
      {/* Main image */}
      <Image
        src={transformAssetUrl(images[activeIdx].image_path)}
        alt={images[activeIdx].alt_text || serviceName}
        fill
        className="object-cover"
        priority
      />

      {/* Gloss overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[1.5rem]"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 60%)", mixBlendMode: "screen" }}
      />

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIdx(i)}
              className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all ${i === activeIdx ? "border-red-600 scale-110" : "border-white/20 opacity-60 hover:opacity-100"}`}
            >
              <Image src={transformAssetUrl(img.image_path, 80, 80)} alt="" width={32} height={32} className="object-cover w-full h-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminServices() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const serviceList = useMemo(() => services, [services]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickUploadRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [quickUploadServiceId, setQuickUploadServiceId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const isOverLimit = totalFileSize > MAX_UPLOAD_BYTES;

  const [currentService, setCurrentService] = useState<Partial<Service>>({
    name: "", price: 0, booking_fee: 0, duration_minutes: 40, is_active: true, sort_order: 0, description: "", images: []
  });

  const fetchServices = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken();
      const res = await syndicateFetch("/api/v1/admin/services", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setServices(await res.json());
    } catch { /* silent */ } finally { setIsLoading(false); }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => { if (isLoaded && isSignedIn) fetchServices(); }, [isLoaded, isSignedIn, fetchServices]);

  // Inline patch — just name, price, or booking_fee
  const patchField = async (serviceId: number, field: string, value: string) => {
    const token = await getToken();
    const fd = new FormData();
    fd.append(field, value);
    const res = await syndicateFetch(`/api/v1/admin/services/${serviceId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }, 1, 10000);
    if (res.ok) {
      const updated: Service = await res.json();
      setServices(prev => prev.map(s => s.id === serviceId ? updated : s));
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (isOverLimit) { setSaveError(`Images too large — ${(totalFileSize / 1024 / 1024).toFixed(1)}MB selected, max 4MB.`); return; }
    setIsSaving(true);
    try {
      const token = await getToken();
      const method = currentService.id ? "PATCH" : "POST";
      const url = currentService.id ? `/api/v1/admin/services/${currentService.id}` : "/api/v1/admin/services";
      const fd = new FormData();
      if (currentService.name) fd.append("name", currentService.name);
      if (currentService.price !== undefined) fd.append("price", currentService.price.toString());
      if (currentService.booking_fee !== undefined && currentService.booking_fee !== null) fd.append("booking_fee", currentService.booking_fee.toString());
      if (currentService.duration_minutes !== undefined) fd.append("duration_minutes", currentService.duration_minutes.toString());
      if (currentService.description) fd.append("description", currentService.description);
      if (currentService.is_active !== undefined) fd.append("is_active", currentService.is_active.toString());
      if (currentService.sort_order !== undefined) fd.append("sort_order", currentService.sort_order.toString());
      selectedFiles.forEach(f => fd.append("files", f));
      const res = await syndicateFetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd }, 2, 60000);
      if (res.ok) { setIsModalOpen(false); setSelectedFiles([]); setSaveError(null); fetchServices(); }
      else if (res.status === 413) setSaveError("Server rejected upload — keep total under 4MB.");
      else setSaveError("Save failed. Try again.");
    } catch { setSaveError("Upload timed out. Try fewer or smaller images."); }
    finally { setIsSaving(false); }
  };

  const handleDeleteService = async (serviceId: number) => {
    setDeleteConfirmId(null);
    try {
      const token = await getToken();
      const res = await syndicateFetch(`/api/v1/admin/services/${serviceId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setIsModalOpen(false); fetchServices(); }
    } catch { /* silent */ }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      const token = await getToken();
      const res = await syndicateFetch(`/api/v1/admin/services/images/${imageId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok && currentService.images) {
        setCurrentService(prev => ({ ...prev, images: prev.images?.filter(img => img.id !== imageId) }));
      }
    } catch { /* silent */ }
  };

  // Quick upload directly from service card
  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !quickUploadServiceId) return;
    setIsUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("files", f));
      const res = await syndicateFetch(`/api/v1/admin/services/${quickUploadServiceId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      }, 2, 60000);
      if (res.ok) fetchServices();
    } catch { /* silent */ }
    finally {
      setIsUploading(false);
      setQuickUploadServiceId(null);
      if (quickUploadRef.current) quickUploadRef.current.value = "";
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Hidden quick-upload input */}
      <input
        ref={quickUploadRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleQuickUpload}
      />

      <header className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] mb-3">Service Catalog</p>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Inventory Control</h2>
        </div>
        <button
          onClick={() => {
            setCurrentService({ name: "", price: 0, booking_fee: 0, duration_minutes: 40, is_active: true, sort_order: 0, description: "", images: [] });
            setSelectedFiles([]);
            setSaveError(null);
            setIsModalOpen(true);
          }}
          className="px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl"
        >
          + Add New Service
        </button>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3].map(i => <div key={i} className="h-80 bg-white/[0.02] border border-white/5 rounded-[2.5rem] animate-pulse" />)}
        </div>
      )}

      {/* ── Service Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {serviceList.map((service) => (
          <div key={service.id} className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden hover:bg-white/[0.04] transition-all">

            {/* 3D Gallery */}
            <div className="p-4 pb-0">
              <Gallery3D images={service.images} serviceName={service.name} />
            </div>

            {/* Overlay badges */}
            {!service.is_active && (
              <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full">
                <span className="text-[7px] font-black uppercase tracking-widest text-white/40 italic">Draft</span>
              </div>
            )}

            <div className="p-6">
              {/* Name — inline editable */}
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-base font-black uppercase tracking-widest">
                  <InlineEdit
                    value={service.name}
                    onSave={(v) => patchField(service.id, "name", v)}
                    className="text-base font-black uppercase tracking-widest"
                  />
                </h4>
                {/* Price — inline editable */}
                <span className="text-sm font-black italic text-red-600">
                  <InlineEdit
                    value={service.price}
                    onSave={(v) => patchField(service.id, "price", v)}
                    prefix="$"
                    type="number"
                    className="text-sm font-black italic text-red-600 text-right"
                  />
                </span>
              </div>

              {/* Booking fee — inline editable */}
              <div className="flex items-center gap-1.5 mb-4">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Booking Fee:</span>
                <span className="text-[9px] font-black text-white/50">
                  <InlineEdit
                    value={service.booking_fee ?? 0}
                    onSave={(v) => patchField(service.id, "booking_fee", v)}
                    prefix="$"
                    type="number"
                    className="text-[9px] font-black text-white/50"
                  />
                </span>
              </div>

              {/* Action row */}
              <div className="flex gap-2 items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20 italic flex-1">{service.duration_minutes} MINS</span>

                {/* Upload photo button */}
                <button
                  onClick={() => {
                    setQuickUploadServiceId(service.id);
                    setTimeout(() => quickUploadRef.current?.click(), 50);
                  }}
                  disabled={isUploading && quickUploadServiceId === service.id}
                  title="Add photos"
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group/btn"
                >
                  {isUploading && quickUploadServiceId === service.id ? (
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30 animate-pulse">Uploading…</span>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30 group-hover/btn:text-white/70 transition-colors">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 group-hover/btn:text-white/70 transition-colors">Photo</span>
                    </>
                  )}
                </button>

                {/* Edit (opens full modal) */}
                <button
                  onClick={() => {
                    setCurrentService({ ...service });
                    setSelectedFiles([]);
                    setSaveError(null);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  Edit
                </button>

                {/* Delete */}
                {deleteConfirmId === service.id ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="px-3 py-2 bg-red-600/20 border border-red-600/40 rounded-xl text-[8px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600/40 transition-all"
                    >Confirm</button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(service.id)}
                    title="Delete service"
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-600/10 hover:border-red-600/30 transition-all group/del"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/20 group-hover/del:text-red-500 transition-colors">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Full Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
          <div className="bg-[#050505] border border-white/10 w-full max-w-2xl rounded-[3rem] p-12 shadow-[0_0_100px_rgba(220,38,38,0.1)] overflow-y-auto max-h-[90vh]">
            <header className="mb-10">
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Service Data Terminal</p>
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">{currentService.id ? "Edit Service" : "New Service"}</h3>
            </header>

            <div className="space-y-8">
              {/* Name + Price */}
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
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Service Price ($ USD)</label>
                  <input
                    type="number"
                    value={currentService.price}
                    onChange={(e) => setCurrentService({ ...currentService, price: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                  />
                </div>
              </div>

              {/* Booking fee */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
                  Online Booking Fee ($ USD)
                  <span className="ml-2 text-white/10 normal-case font-medium tracking-normal">— charged when customer books online</span>
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={currentService.booking_fee ?? 0}
                  onChange={(e) => setCurrentService({ ...currentService, booking_fee: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Description</label>
                <textarea
                  value={currentService.description || ""}
                  onChange={(e) => setCurrentService({ ...currentService, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-medium text-white/70 outline-none focus:border-red-600 transition-all resize-none"
                />
              </div>

              {/* Images */}
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Service Photos</label>
                <div className="flex gap-4">
                  <input type="file" multiple ref={fileInputRef} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); }} className="hidden" accept="image/*" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/40 group-hover:text-red-600 transition-colors">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-red-600 transition-colors">
                      {selectedFiles.length > 0 ? "Change Files" : "Upload Photos"}
                    </span>
                  </button>
                </div>

                {selectedFiles.length > 0 && (
                  <div className={`flex items-center gap-3 p-4 border rounded-2xl animate-in slide-in-from-left-2 duration-300 ${isOverLimit ? "bg-orange-600/15 border-orange-500/40" : "bg-red-600/10 border-red-600/20"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isOverLimit ? "bg-orange-500" : "bg-red-600 animate-pulse"}`} />
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isOverLimit ? "text-orange-400" : "text-red-600"}`}>
                      {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} — {(totalFileSize / 1024 / 1024).toFixed(2)}MB / 4MB max
                    </span>
                    {isOverLimit && <span className="text-[8px] font-bold text-orange-400/80 uppercase tracking-widest">⚠ Too large</span>}
                    <button onClick={() => { setSelectedFiles([]); setSaveError(null); }} className="ml-auto text-[8px] font-black text-white/20 hover:text-white uppercase tracking-widest">Clear</button>
                  </div>
                )}

                {/* Existing images grid with 3D preview */}
                {currentService.images && currentService.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {currentService.images.map(img => (
                      <div key={img.id} className="group/img aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/5 relative" style={{ transformStyle: "preserve-3d" }}>
                        <Image src={transformAssetUrl(img.image_path, 200, 200)} alt="Gallery" width={100} height={100} className="object-cover w-full h-full" unoptimized />
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                        >
                          <span className="text-[10px] text-white leading-none">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Duration + Visibility */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Duration</label>
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
                  <button
                    onClick={() => setCurrentService({ ...currentService, is_active: !currentService.is_active })}
                    className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${currentService.is_active ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-white/5 text-white/20 border border-white/10"}`}
                  >
                    {currentService.is_active ? "Public Catalog" : "Hidden Draft"}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {saveError && (
                <div className="flex items-start gap-3 p-5 bg-orange-600/10 border border-orange-500/30 rounded-2xl animate-in slide-in-from-bottom-2 duration-300">
                  <span className="text-orange-400 text-sm mt-0.5">⚠</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">Error</span>
                    <span className="text-[9px] text-orange-300/80 leading-relaxed">{saveError}</span>
                  </div>
                  <button onClick={() => setSaveError(null)} className="ml-auto text-orange-400/40 hover:text-orange-400 text-sm">×</button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4 pt-8">
                {currentService.id && (
                  <button
                    onClick={() => handleDeleteService(currentService.id!)}
                    className="px-6 py-5 border border-red-600/30 text-red-600/60 text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-red-600/10 hover:text-red-500 transition-all"
                  >Delete</button>
                )}
                <button
                  onClick={() => { setIsModalOpen(false); setSaveError(null); }}
                  className="flex-1 py-5 border border-white/10 text-white/20 text-[10px] font-black uppercase tracking-widest rounded-3xl hover:bg-white/5 transition-all"
                >Discard</button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || isOverLimit}
                  className={`flex-[2] py-5 text-[10px] font-black uppercase tracking-widest rounded-3xl transition-all ${
                    isOverLimit ? "bg-orange-600/20 text-orange-400/60 border border-orange-500/20 cursor-not-allowed"
                    : isSaving ? "bg-red-600/50 text-white/50 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-500 shadow-[0_10px_40px_rgba(220,38,38,0.3)]"
                  }`}
                >
                  {isSaving ? "Saving…" : isOverLimit ? "⚠ Images Too Large" : currentService.id ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
