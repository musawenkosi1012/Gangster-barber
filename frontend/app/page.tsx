"use client";

import { useEffect } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { BRAND } from "@/utils/constants";

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
    
    document.querySelectorAll('.reveal, .reveal-clip').forEach(el => {
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
          <div className="text-center relative z-10 w-full">
            {/* Brand logo above hero headline */}
            <div className="reveal flex justify-center mb-6 active">
              <Image
                src="/logo.png"
                alt="Gangster Barber"
                width={96}
                height={96}
                className="rounded-2xl shadow-[0_0_40px_rgba(220,38,38,0.25)] border border-white/10"
                priority
              />
            </div>
            <p className="reveal text-sm md:text-lg text-gray-400 font-medium tracking-widest uppercase mb-4 active">
              Welcome to the
            </p>
            <h1 className="reveal-clip hero-title gradient-text mb-6 break-words hyphens-auto active" style={{ transitionDelay: '150ms' }}>
              GANGSTER<br className="md:hidden" /> BARBER.
            </h1>
            <div className="reveal mx-auto w-24 h-1.5 bg-red-600 rounded-full mb-8 active" style={{ transitionDelay: '300ms' }}></div>
            <p className="reveal text-lg md:text-2xl text-gray-400 max-w-2xl mx-auto font-medium tracking-tight px-4 leading-snug active" style={{ transitionDelay: '450ms' }}>
              Gweru&apos;s finest barbershop. Clean fades, sharp lineups, and the freshest cuts in town.
            </p>
            <div className="reveal mt-8 md:mt-12 text-center active" style={{ transitionDelay: '600ms' }}>
              <Show when="signed-out">
                <SignInButton mode="modal" forceRedirectUrl="/book">
                  <button className="btn-booking text-lg md:text-xl px-10 md:px-16 py-5 md:py-7">
                    Book a Session
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link 
                  href="/book"
                  className="btn-booking text-lg md:text-xl px-10 md:px-16 py-5 md:py-7"
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
                <span className="reveal text-red-600 font-black uppercase tracking-[0.3em] text-[10px] mb-6 block">Precision Craft</span>
                <h2 className="reveal-clip text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tighter leading-[0.85] mb-10 uppercase break-words hyphens-auto">
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
        <div className="text-center mb-20 md:mb-32 reveal-clip px-6">
          <h2 className="text-[clamp(2.5rem,10vw,8rem)] font-black tracking-tighter mb-4 uppercase break-words hyphens-auto text-white/90">Our <span className="serif italic lowercase font-normal text-red-600">Services.</span></h2>
          <p className="reveal text-gray-500 text-sm md:text-base font-medium tracking-widest uppercase">Premium grooming experience</p>
        </div>
        
        <div className="bento-grid">
          <div className="bento-card col-span-12 md:col-span-8 reveal group overflow-hidden">
            <div className="p-8 md:p-16 relative z-20 h-full flex flex-col justify-end md:justify-start">
              <span className="card-label">Signature Cut</span>
              <h3 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-white uppercase">Taper Fade</h3>
              <p className="text-gray-400 max-w-sm text-base md:text-lg leading-relaxed font-medium">Clean, smooth taper fade blended to perfection. The freshest cut in Gweru, tailored to your face shape.</p>
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
        <div className="reveal-clip max-w-5xl">
          <h2 className="text-[clamp(3rem,12vw,10rem)] font-black mb-10 tracking-tighter gradient-text leading-none uppercase break-words hyphens-auto">STAY SHARP.</h2>
          <p className="text-gray-400 text-lg md:text-xl mb-16 max-w-2xl mx-auto leading-relaxed font-medium">Don&apos;t miss out, book a session with the Gangster Barber.</p>
          
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/book">
               <button className="btn-booking text-lg md:text-xl px-12 md:px-16 py-5 md:py-7">Book Appointment</button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
             <Link href="/book" className="btn-booking text-lg md:text-xl px-12 md:px-16 py-5 md:py-7">Book Appointment</Link>
          </Show>
        </div>
      </section>

      {/* ═══ FAQ — Targets "People also ask" + local search queries ═══ */}
      <section id="faq" className="py-24 md:py-40 px-6 bg-transparent relative z-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 md:mb-24">
            <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px] block mb-4">Need Answers?</span>
            <h2 className="text-[clamp(2rem,7vw,5rem)] font-black tracking-tighter uppercase leading-none">
              FAQ<span className="text-red-600">.</span>
            </h2>
            <p className="text-gray-500 text-sm mt-4 font-medium tracking-widest uppercase">Everything you need to know about Gangster Barber, Gweru</p>
          </div>

          <dl className="space-y-4">
            {[
              {
                q: "Where is Gangster Barber located in Gweru?",
                a: "We're in Senga, Nehosho, Gweru — open Monday to Sunday, 7am to 7pm. Walk-ins are always welcome, or book your slot online."
              },
              {
                q: "How much does a haircut cost?",
                a: "Cuts start from $2 USD. Taper fades, lineups, beard sculpts and full grooming packages are all available at prices that won't break the bank."
              },
              {
                q: "Can I book a haircut online?",
                a: "Yes — book your session at gangsterbarber.com/book. Pick a service, choose a time slot and pay via EcoCash, OneMoney, InnBucks or cash on arrival."
              },
              {
                q: "What services do you offer?",
                a: "Taper fades, skin fades, lineup & shape-ups, beard sculpts, beard trims, and The Full Gangster — our complete grooming package. All precision work, every time."
              },
              {
                q: "Do you accept EcoCash and OneMoney?",
                a: "Absolutely. We accept EcoCash, OneMoney, InnBucks, O'Mari and cash. You can also pay online when booking through our website."
              },
              {
                q: "Are walk-ins welcome?",
                a: "Walk-ins are always welcome. Appointments are preferred so we can reserve your slot — book online in under 2 minutes."
              },
            ].map(({ q, a }, i) => (
              <details
                key={i}
                className="group bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden cursor-pointer"
              >
                <summary className="flex items-center justify-between px-8 py-6 list-none">
                  <h3 className="text-sm md:text-base font-black uppercase tracking-tight pr-4">{q}</h3>
                  <span className="text-red-600 text-xl font-black shrink-0 group-open:rotate-45 transition-transform duration-300">+</span>
                </summary>
                <p className="px-8 pb-6 text-gray-400 text-sm md:text-base leading-relaxed font-medium">{a}</p>
              </details>
            ))}
          </dl>

          <div className="mt-16 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mb-6">Still have questions? Reach out on WhatsApp</p>
            <a
              href={`https://wa.me/${BRAND.barber.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 border border-white/10 rounded-full text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
