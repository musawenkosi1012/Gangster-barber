import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
    canonical: "https://gangsterbarber.com/services",
  },
  openGraph: {
    title: "Barber Services & Prices | Gangster Barber Gweru",
    description: "Taper fades, lineups, beard sculpts & full grooming from $2. Best barber in Gweru, Zimbabwe. Walk-ins welcome.",
    url: "https://gangsterbarber.com/services",
    type: "website",
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "Gangster Barber Gweru — Services & Prices" }],
  },
};

const services = [
  {
    name: "Taper Fade",
    slug: "taper-fade",
    tagline: "The Freshest Cut in Gweru",
    description: "Clean, smooth taper fade blended to perfection. Whether you want a low, mid or high taper — we tailor every fade to your face shape and hair texture. The go-to cut for Gweru's sharpest guys.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Low fade", "Mid fade", "High fade", "Skin fade", "Taper haircut Gweru"],
  },
  {
    name: "Lineup & Shape-Up",
    slug: "lineup-shape-up",
    tagline: "Razor Sharp. Every Time.",
    description: "Precision razor lineup, edge-up and hairline detailing. We carve a clean, defined hairline that frames your face perfectly. Walk in rough, walk out looking like a million dollars.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Hairline lineup", "Edge-up", "Shape-up Gweru", "Razor lineup"],
  },
  {
    name: "Beard Sculpt",
    slug: "beard-sculpt",
    tagline: "Groomed to Perfection.",
    description: "Full beard trim, sculpting and detailing. We shape, define and clean up your beard for a polished, professional look. From stubble shaping to full beard styling.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Beard trim Gweru", "Beard sculpt", "Beard grooming", "Facial hair"],
  },
  {
    name: "The Full Gangster",
    slug: "full-gangster",
    tagline: "The Complete Package.",
    description: "Haircut, beard trim, lineup, and the works. Our flagship service — the complete grooming experience that covers everything from the top of your head to your jawline. Gweru's finest, all in one session.",
    price: "From $5",
    duration: "80 mins",
    tags: ["Full grooming Gweru", "Haircut and beard Gweru", "Complete barber package"],
  },
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Gangster Barber Services",
  "description": "Barbershop services offered by Gangster Barber in Gweru, Zimbabwe",
  "url": "https://gangsterbarber.com/services",
  "itemListElement": services.map((s, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "item": {
      "@type": "Service",
      "name": s.name,
      "description": s.description,
      "provider": {
        "@type": "BarberShop",
        "name": "Gangster Barber",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Gweru",
          "addressRegion": "Midlands Province",
          "addressCountry": "ZW"
        }
      },
      "areaServed": "Gweru, Zimbabwe",
      "offers": {
        "@type": "Offer",
        "price": s.price.replace("From $", ""),
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "url": "https://gangsterbarber.com/book"
      }
    }
  }))
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
          <Link
            href="/book"
            className="px-10 py-5 bg-white text-black text-sm font-black uppercase tracking-widest rounded-full hover:bg-red-600 hover:text-white transition-all shadow-xl"
          >
            Book Now
          </Link>
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

      {/* Services */}
      <section className="py-20 px-6 max-w-5xl mx-auto space-y-6">
        {services.map((service, i) => (
          <article
            key={i}
            className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 hover:bg-white/[0.04] transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600 mb-3 block">{service.tagline}</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4">{service.name}</h2>
                <p className="text-gray-400 leading-relaxed font-medium mb-6 max-w-2xl">{service.description}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {service.tags.map(tag => (
                    <span key={tag} className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-white/40">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl md:text-4xl font-black italic text-red-600">{service.price}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">{service.duration}</p>
                <Link
                  href="/book"
                  className="mt-6 inline-block px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all"
                >
                  Book This
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

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
