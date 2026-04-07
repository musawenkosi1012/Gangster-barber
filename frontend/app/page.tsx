"use client";

import { useEffect } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const ThreeScene = dynamic(() => import("@/components/ThreeScene"), { ssr: false });


export default function Home() {
  useEffect(() => {
    const obsOptions = {
      root: null,
      threshold: 0.05,
      rootMargin: "0px"
    };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, obsOptions);
    
    document.querySelectorAll('.reveal').forEach(el => {
      if (window.innerWidth < 768) {
        el.classList.add('active');
      } else {
        obs.observe(el);
      }
    });

    // Fix for mobile address bar
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);

    return () => {
        obs.disconnect();
        window.removeEventListener('resize', setVh);
    };
  }, []);

  return (
    <main className="relative bg-transparent">
      <Navbar />
      <ThreeScene />

      {/* ═══ HERO — Single clipper, center stage ═══ */}
      <section id="hero" className="h-[120vh] md:h-[250vh]">
        <div className="sticky top-0 h-[100dvh] md:h-screen flex flex-col items-center justify-center px-4 overflow-visible">
          <div className="reveal active text-center relative z-10 w-full">
            <p className="text-sm md:text-lg text-gray-400 font-medium tracking-widest uppercase mb-4">Welcome to the</p>
            <h1 className="hero-title gradient-text mb-6 break-words hyphens-auto">GANGSTER<br className="md:hidden" /> BARBER.</h1>
            <div className="mx-auto w-24 h-1.5 bg-red-600 rounded-full mb-8"></div>
            <p className="text-lg md:text-2xl text-gray-400 max-w-2xl mx-auto font-medium tracking-tight px-4 leading-snug">
              Gweru&apos;s finest barbershop. Clean fades, sharp lineups, and the freshest cuts in town.
            </p>
            <div className="mt-8 md:mt-12 text-center">
              <Show when="signed-out">
                <SignInButton mode="modal" forceRedirectUrl="/book">
                  <button className="btn-booking text-xl md:text-3xl px-12 md:px-20 py-6 md:py-10">
                    Book a Session
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link 
                  href="/book"
                  className="btn-booking text-xl md:text-3xl px-12 md:px-20 py-6 md:py-10"
                >
                  Book a Session
                </Link>
              </Show>

            </div>


          </div>
        </div>
      </section>

      {/* ═══ ENGINEERING — All 3 clippers in formation ═══ */}
      <section id="engineering" className="h-[130vh] md:h-[250vh] relative">
        <div className="sticky top-0 h-[100dvh] md:h-screen flex items-center justify-center overflow-visible">
          <div className="max-w-7xl mx-auto px-6 md:px-12 reveal w-full relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 items-center">
              <div className="order-2 md:order-1 max-w-lg relative z-20">
                <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px] mb-6 block">Precision Craft</span>
                <h2 className="text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tighter leading-[0.85] mb-10 uppercase break-words hyphens-auto">
                  Every Cut<br /><span className="text-gray-600">Matters.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-400 leading-relaxed mb-12 max-w-md font-medium">
                  We don&apos;t just cut hair, we craft confidence. Every fade, lineup, and beard sculpt is a masterpiece.
                </p>

                <div className="h-1.5 w-24 bg-red-600"></div>
              </div>
              <div className="relative order-1 md:order-2">
                {/* The 3D scene IS the visual here */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LINEUP — Clippers spread, dramatic showcase ═══ */}
      <section id="lineup" className="py-24 md:py-40 bg-transparent relative z-20">
        <div className="text-center mb-24 md:mb-32 reveal px-6">
          <h2 className="text-[clamp(2.5rem,12vw,10rem)] font-black tracking-tighter mb-6 uppercase break-words hyphens-auto">OUR <span className="serif italic lowercase font-normal">Services.</span></h2>
          <p className="text-gray-500 text-lg md:text-xl font-bold tracking-widest uppercase text-[10px]">Premium grooming, every time.</p>
        </div>
        
        <div className="bento-grid">
          <div className="bento-card col-span-12 md:col-span-8 reveal group overflow-hidden">
            <div className="p-8 md:p-16 relative z-20 h-full flex flex-col justify-end md:justify-start">
              <span className="card-label">Signature Cut</span>
              <h3 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-white uppercase">Taper Fade</h3>
              <p className="text-gray-400 max-w-sm text-base md:text-lg leading-relaxed font-medium">Clean, smooth taper fade blended to perfection. The freshest cut in Gweru, tailored to your face shape every time.</p>
              <div className="mt-8 transition-all duration-500 transform translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0">
                 <span className="inline-flex items-center text-[10px] font-black tracking-[0.3em] text-white uppercase border-b border-red-600 pb-1">Book Now &rarr;</span>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image 
              src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=1200" 
              className="card-img object-cover transition-transform duration-1000 group-hover:scale-110" 
              alt="Taper fade haircut" 
              width={1200}
              height={800}
              priority
            />
          </div>

          <div className="bento-card col-span-12 md:col-span-4 reveal group overflow-hidden" style={{ transitionDelay: "0.1s" }}>
            <div className="p-8 md:p-12 h-full flex flex-col justify-between relative z-20">
              <div>
                <span className="card-label">Starting From</span>
                <h3 className="text-3xl md:text-4xl font-black mb-6 tracking-tighter uppercase text-white">Bookings</h3>
                <p className="text-gray-300 text-base md:text-md leading-relaxed font-medium">Premium cuts, fades, lineups, and beard work. All at prices that won&apos;t break the bank.</p>
              </div>
              <div className="mt-10">
                <div className="text-6xl font-black tracking-tighter text-white">$2<span className="text-lg text-gray-400 font-bold ml-2">&amp; UP</span></div>
                <p className="text-gray-400 text-xs mt-2 normal-case tracking-normal font-medium">Quality grooming starts here</p>
                <div className="mt-6 border-t border-white/10 pt-6 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <span className="inline-flex items-center text-[10px] font-black tracking-[0.3em] text-red-600 uppercase">Book Now &rarr;</span>
                </div>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image 
              src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600" 
              className="card-img object-cover transition-transform duration-1000 group-hover:scale-110" 
              alt="Barber booking" 
              width={600}
              height={800}
            />
          </div>
          
          <div className="bento-card col-span-12 md:col-span-4 reveal group" style={{ transitionDelay: "0.2s" }}>
             <div className="p-8 md:p-12 relative z-20">
                <span className="card-label">Clean Lines</span>
                <h3 className="text-3xl md:text-4xl font-black mb-4 tracking-tighter uppercase">Lineup &amp; Shape-Up</h3>
                <p className="text-gray-500 text-base md:text-md leading-relaxed font-medium">Precision razor lineup, edge-up, and hairline detailing. Walk in rough, walk out looking like a million dollars.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image 
              src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=600" 
              className="card-img object-cover transition-transform duration-1000 group-hover:scale-110" 
              alt="Lineup detail" 
              width={600}
              height={800}
            />
          </div>

          <div className="bento-card col-span-12 md:col-span-8 reveal group" style={{ transitionDelay: "0.3s" }}>
             <div className="p-8 md:p-16 relative z-20 h-full flex flex-col justify-end md:justify-start">
                <span className="card-label">Full Treatment</span>
                <h3 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-white uppercase">The Full Gangster</h3>
                <p className="text-gray-400 max-w-sm text-base md:text-lg leading-relaxed font-medium">Haircut, beard trim, lineup, and the works. The complete grooming experience. Gweru&apos;s finest, all in one session.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image 
              src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=1200" 
              className="card-img object-cover transition-transform duration-1000 group-hover:scale-110" 
              alt="The Full Gangster service" 
              width={1200}
              height={800}
            />
          </div>
        </div>
      </section>

      {/* ═══ FINAL BOOKING — Clippers converge, max drama ═══ */}
      <section id="booking" className="min-h-screen flex items-center justify-center text-center px-6 py-20 md:py-40 bg-transparent relative z-20">
        <div className="reveal max-w-5xl">
          <h2 className="text-[clamp(3rem,15vw,14rem)] font-black mb-10 tracking-tighter gradient-text leading-none uppercase break-words hyphens-auto">STAY SHARP.</h2>
          <p className="text-gray-400 text-lg md:text-2xl mb-16 max-w-2xl mx-auto leading-relaxed font-medium">Don&apos;t miss out, book a session with the Gangster Barber.</p>
          
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/book">
               <button className="btn-booking text-lg md:text-xl px-12 md:px-20 py-6 md:py-8">Book Appointment</button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
             <Link href="/book" className="btn-booking text-lg md:text-xl px-12 md:px-20 py-6 md:py-8">Book Appointment</Link>
          </Show>

        </div>
      </section>

      <Footer />
    </main>
  );
}
