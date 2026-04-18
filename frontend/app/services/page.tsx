import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServicesClient from "@/components/pages/ServicesClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

export const metadata: Metadata = {
  title: "Barber Services & Prices in Gweru",
  description: "Taper fades, lineups, beard sculpts & full grooming packages from $2. Best barber in Gweru, Senga & Nehosho. Walk-ins welcome. Book online today.",
  keywords: [
    "barber services Gweru",
    "taper fade Gweru",
    "haircut prices Gweru",
    "lineup Gweru",
    "beard sculpt Gweru",
    "skin fade Gweru",
    "barber shop Gweru Zimbabwe",
    "cheap haircut Gweru",
    "barber Senga Gweru",
    "barber Nehosho Gweru",
  ],
  alternates: {
    canonical: `${SITE_URL}/services`,
  },
  openGraph: {
    title: "Barber Services & Prices | Gangster Barber Gweru",
    description: "Taper fades, lineups, beard sculpts & full grooming from $2. Best barber in Gweru, Zimbabwe. Walk-ins welcome.",
    url: `${SITE_URL}/services`,
    type: "website",
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "Gangster Barber Gweru — Services & Prices" }],
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Gangster Barber Services",
  "description": "Barbershop services offered by Gangster Barber in Gweru, Zimbabwe",
  "url": `${SITE_URL}/services`,
  "itemListElement": []
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 text-center">
        <p className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Gweru's Best</p>
        <h1 className="text-[clamp(3rem,10vw,8rem)] font-black tracking-tighter uppercase leading-none mb-6">
          Services<span className="text-red-600">.</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed font-medium">
          Precision cuts, sharp fades and clean grooming. Every service crafted for Gweru's finest — starting from $2.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <a
            href="/book"
            className="px-10 py-5 bg-white text-black text-sm font-black uppercase tracking-widest rounded-full hover:bg-red-600 hover:text-white transition-all shadow-xl"
          >
            Book Now
          </a>
          <a
            href="https://wa.me/263773772047"
            target="_blank"
            rel="noopener noreferrer"
            className="px-10 py-5 border border-white/10 text-sm font-black uppercase tracking-widest rounded-full hover:border-red-600 hover:text-red-600 transition-all"
          >
            WhatsApp Us
          </a>
        </div>
      </section>

      {/* Services - Fetched from API */}
      <ServicesClient />

      {/* Local SEO section */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 grid md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-4xl font-black italic text-red-600 mb-2">$2</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Starting Price</p>
          </div>
          <div>
            <p className="text-4xl font-black italic text-white mb-2">7 Days</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Mon–Sun 7am–7pm</p>
          </div>
          <div>
            <p className="text-4xl font-black italic text-white mb-2">Senga</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Nehosho, Gweru</p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
