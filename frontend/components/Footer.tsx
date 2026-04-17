"use client";

import React from "react";
import Link from "next/link";
import { BRAND } from "@/utils/constants";
import { useLegal } from "@/context/LegalContext";

export default function Footer() {
  const { openVault } = useLegal();
  return (
    <footer className="bg-[#050505] pt-24 pb-10 px-6 md:px-10 text-[#555] text-[10px] font-bold leading-loose uppercase tracking-[0.3em] border-t border-white/5 relative z-10">
      <div className="max-w-6xl mx-auto border-b border-white/5 pb-16 mb-12 flex flex-col md:flex-row justify-between items-start gap-12">
        
        {/* Barber Info */}
        <div className="max-w-xs">
          <div className="text-white text-2xl font-black tracking-tighter normal-case mb-4">
            GANGSTER<span className="text-red-600">.</span>
          </div>
          <p className="text-white/40 normal-case tracking-normal text-xs leading-relaxed font-medium">
            Premium grooming for the untouchable. Walk-ins welcome, appointments preferred.
          </p>
        </div>

        {/* Location */}
        <div className="flex flex-col gap-3 text-white/50">
          <span className="text-white mb-1 underline underline-offset-4 decoration-red-600">Location</span>
          <span className="normal-case tracking-normal text-xs">Senga, Nehosho</span>
          <span className="normal-case tracking-normal text-xs">Gweru, Zimbabwe</span>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3 text-white/50">
          <span className="text-white mb-1 underline underline-offset-4 decoration-red-600">Contact</span>
          <a href={`https://wa.me/${BRAND.barber.whatsapp}`} target="_blank" className="hover:text-red-600 transition normal-case tracking-normal text-xs">WhatsApp: +{BRAND.barber.whatsapp}</a>
          <a href={`https://instagram.com/${BRAND.barber.instagram}`} target="_blank" className="hover:text-red-600 transition normal-case tracking-normal text-xs">Instagram: {BRAND.barber.instagram}</a>
          <a href={`https://facebook.com/${BRAND.barber.facebook}`} target="_blank" className="hover:text-red-600 transition normal-case tracking-normal text-xs">Facebook: {BRAND.barber.facebook}</a>
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-3 text-white/50">
          <span className="text-white mb-1 underline underline-offset-4 decoration-red-600">Hours</span>
          <span className="normal-case tracking-normal text-xs">Mon – Sun: 7am – 7pm</span>
        </div>
      </div>

      {/* Copyright + Legal */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <span>&copy; {new Date().getFullYear()} Gangster Barber</span>
        <div className="flex items-center gap-6">
          <button
            onClick={() => openVault("privacy")}
            className="hover:text-red-600 transition-colors"
          >
            Privacy Policy
          </button>
          <span className="text-white/10">·</span>
          <button
            onClick={() => openVault("terms")}
            className="hover:text-red-600 transition-colors"
          >
            Terms of Service
          </button>
          <span className="text-white/10">·</span>
          <a href="#hero" className="text-white hover:text-red-600 transition">Back to Top &uarr;</a>
        </div>
      </div>

      {/* Developer Signature */}
      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/5">
        <div className="flex flex-col gap-6">
          {/* Dev Signature */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[9px] tracking-[0.2em] text-white/20 normal-case">
            <span className="tracking-normal text-[10px] font-bold text-white/60">
              💻 Website Design & Development by{" "}
              <a href={`https://www.${BRAND.developer.website}`} target="_blank" className="text-red-600/80 hover:text-red-500 transition underline underline-offset-2">
                {BRAND.developer.name}
              </a>
            </span>
            <div className="flex flex-wrap items-center gap-6 text-white/30">
              <div>
                <p className="mb-2 text-white/60 italic text-xs">WhatsApp/Call</p>
                <p className="normal-case tracking-normal text-[10px]">{BRAND.developer.phone}</p>
              </div>
              <div>
                <p className="mb-2 text-white/60 italic text-xs">Email</p>
                <a href={`mailto:${BRAND.developer.email}`} className="normal-case tracking-normal text-[10px] hover:text-red-600 transition underline underline-offset-2">
                  {BRAND.developer.email}
                </a>
              </div>
              <a href={`https://instagram.com/${BRAND.developer.instagram}`} target="_blank" className="hover:text-red-600 transition text-[10px] normal-case tracking-normal">
                @{BRAND.developer.instagram}
              </a>
              <a href={`https://facebook.com/${BRAND.developer.facebook}`} target="_blank" className="hover:text-red-600 transition text-[10px] normal-case tracking-normal">
                {BRAND.developer.facebook}
              </a>
              <a href={`https://www.${BRAND.developer.website}`} target="_blank" className="hover:text-red-600 transition text-[10px] normal-case tracking-normal">
                {BRAND.developer.website}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
