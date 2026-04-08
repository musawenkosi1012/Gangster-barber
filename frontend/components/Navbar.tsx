"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, SignOutButton, Show, UserButton } from "@clerk/nextjs";



// ─── Inline SVG icons ───
const ScissorsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const MapPinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 50);
      // Auto-hide on scroll down, show on scroll up
      if (current > 300) {
        setHidden(current > lastScroll && current - lastScroll > 5);
      } else {
        setHidden(false);
      }
      setLastScroll(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });

  return (
    <>
      {/* ═══ Top Info Bar ═══ */}
      <div className={`fixed top-0 w-full z-[10000] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}>
        <div className={`w-full flex justify-center border-b transition-all duration-500 ${
          scrolled 
            ? "bg-black/40 border-white/5 backdrop-blur-md h-8" 
            : "bg-transparent border-transparent h-8"
        }`}>
          <div className="w-full max-w-[1400px] flex justify-between items-center px-6 md:px-12 text-[9px] tracking-[0.15em] uppercase text-white/30 font-medium">
            <div className="hidden md:flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-white/25">
                <MapPinIcon />
                Senga, Gweru
              </span>
              <span className="text-white/10">|</span>
              <span className="text-white/25">Mon-Sun: 7am-7pm</span>
            </div>
            <div className="flex items-center gap-3 ml-auto md:ml-0">
              <a href="https://wa.me/263773772047" target="_blank" className="flex items-center gap-1.5 text-green-500/60 hover:text-green-400 transition-colors duration-300">
                <WhatsAppIcon />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
              <span className="text-white/10">|</span>
              <a href="tel:+263773772047" className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors duration-300">
                <PhoneIcon />
                <span className="hidden sm:inline">+263 773 772 047</span>
              </a>
              <span className="text-white/10">|</span>
              <a href="https://instagram.com/sukaravtech" target="_blank" className="flex items-center gap-1.5 text-white/30 hover:text-pink-400/70 transition-colors duration-300">
                <InstagramIcon />
              </a>
            </div>
          </div>
        </div>

        {/* ═══ Main Nav ═══ */}
        <nav className={`w-full flex justify-center border-b transition-all duration-500 ${
          scrolled 
            ? "bg-black/70 border-white/5 backdrop-blur-2xl h-[56px]" 
            : "bg-gradient-to-b from-black/50 to-transparent border-transparent h-[60px]"
        }`}>
          <div className="w-full max-w-[1400px] flex justify-between items-center px-6 md:px-12">
            {/* Logo */}
            <Link href="/" className="font-black text-white tracking-tighter text-xl md:text-2xl flex items-center gap-2 group">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/10 border border-red-600/20 group-hover:bg-red-600/20 group-hover:border-red-600/40 transition-all duration-500">
                <ScissorsIcon />
              </span>
              <span className="relative">
                GANGSTER<span className="text-red-600">.</span>
                <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-red-600 group-hover:w-full transition-all duration-500"></span>
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { href: "/#engineering", label: "Our Craft" },
                { href: "/#lineup", label: "Services" },
              ].map((item) => (

                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-5 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50 hover:text-white transition-colors duration-300 group"
                >
                  {item.label}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-red-600 rounded-full group-hover:w-3/4 transition-all duration-500 ease-out"></span>
                </Link>
              ))}
              
              <div className="mx-3 w-px h-5 bg-white/10"></div>
              
              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton mode="modal" forceRedirectUrl="/book">
                    <button className="px-8 py-2.5 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50 hover:text-white transition-colors duration-300">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignInButton mode="modal" forceRedirectUrl="/book">
                    <button className="btn-booking ml-4">
                      Book Now
                    </button>
                  </SignInButton>
                </Show>

                <Show when="signed-in">
                  <div className="flex items-center gap-4">
                    <UserButton />
                    <SignOutButton>
                      <button className="btn-booking">
                        Sign Out
                      </button>
                    </SignOutButton>
                  </div>
                </Show>

              </div>

            </div>


            {/* Mobile Toggle */}
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px] z-[10001] group"
              aria-label="Menu"
            >
              <span className={`w-6 h-[2px] bg-white rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? "rotate-45 translate-y-[7px]" : "group-hover:w-5"}`}></span>
              <span className={`w-6 h-[2px] bg-white rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? "opacity-0 scale-0" : "group-hover:w-4"}`}></span>
              <span className={`w-6 h-[2px] bg-white rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? "-rotate-45 -translate-y-[7px]" : "group-hover:w-5"}`}></span>
            </button>
          </div>
        </nav>
      </div>

      {/* ═══ Mobile Menu Overlay ═══ */}
      <div className={`fixed inset-0 bg-black/95 backdrop-blur-2xl z-[10000] flex flex-col transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}>
        {/* Decorative red glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8">
          <div className="text-red-600/50 text-[10px] font-black tracking-[0.5em] uppercase mb-8">Menu</div>
          
          {[
            { href: "/", label: "Home", delay: "0ms" },
            { href: "/#engineering", label: "Our Craft", delay: "50ms" },
            { href: "/#lineup", label: "Services", delay: "100ms", color: "text-red-500" },
            { href: "/book", label: "Book Now", delay: "150ms" },
          ].map((item) => (
            <Link 
              key={item.href}
              onClick={() => setIsOpen(false)} 
              href={item.href} 
              className={`text-4xl font-black tracking-tight hover:text-red-600 transition-all duration-500 py-2 ${item.color || "text-white"} ${
                isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: isOpen ? item.delay : "0ms" }}
            >
              {item.label}
            </Link>
          ))}

          {/* mobile auth buttons */}
          <div className={`flex flex-col items-center mt-4 transition-all duration-700 ${isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`} style={{ transitionDelay: isOpen ? "200ms" : "0ms" }}>
            <Show when="signed-out">
              <SignInButton mode="modal" forceRedirectUrl="/book">
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="text-4xl font-black tracking-tight hover:text-red-600 transition-all duration-500 py-2 uppercase text-white/40"
                >
                  Sign In
                </button>
              </SignInButton>
            </Show>

            <Show when="signed-in">
              <div className="flex flex-col items-center gap-4 mt-6">
                <div className="group relative">
                  <div className="absolute -inset-1 bg-red-600/20 rounded-full blur-md group-hover:bg-red-600/40 transition-all duration-500"></div>
                  <div className="relative p-1 rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
                    <UserButton />
                  </div>
                </div>
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/30">Member Access</span>
              </div>
            </Show>
          </div>
        </div>

        {/* Mobile contact section */}
        <div className={`px-8 pb-12 transition-all duration-700 ${isOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`} style={{ transitionDelay: isOpen ? "200ms" : "0ms" }}>
          <div className="border-t border-white/10 pt-8">
            <div className="flex items-center justify-center gap-6">
              <a href="https://wa.me/263773772047" target="_blank" className="flex items-center gap-2 text-green-500/60 hover:text-green-400 transition-colors text-xs font-bold tracking-wider uppercase">
                <span className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <WhatsAppIcon />
                </span>
                WhatsApp
              </a>
              <a href="tel:+263773772047" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-xs font-bold tracking-wider uppercase">
                <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <PhoneIcon />
                </span>
                Call
              </a>
              <a href="https://instagram.com/sukaravtech" target="_blank" className="flex items-center gap-2 text-white/40 hover:text-pink-400/70 transition-colors text-xs font-bold tracking-wider uppercase">
                <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <InstagramIcon />
                </span>
                Insta
              </a>
            </div>
            <p className="text-center text-white/15 text-[10px] tracking-widest uppercase mt-6">Senga, Nehosho, Gweru</p>
          </div>
        </div>
      </div>
    </>
  );
}
