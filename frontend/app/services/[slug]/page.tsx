import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { services, getServiceBySlug } from "@/data/services";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    return { title: "Service Not Found" };
  }

  const description =
    service.description.length > 158
      ? `${service.description.slice(0, 155).trim()}…`
      : service.description;

  return {
    title: `${service.name} in Gweru`,
    description,
    keywords: [...service.tags, "barber Gweru", "Gangster Barber", `${service.name} Gweru`],
    alternates: {
      canonical: `${SITE_URL}/services/${service.slug}`,
    },
    openGraph: {
      title: `${service.name} | Gangster Barber Gweru`,
      description,
      url: `${SITE_URL}/services/${service.slug}`,
      type: "article",
      images: [
        {
          url: service.image.src,
          width: 1200,
          height: 600,
          alt: service.image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.name} in Gweru | Gangster Barber`,
      description,
      images: [service.image.src],
    },
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const priceValue = service.price.replace("From $", "");

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": service.name,
    "description": service.description,
    "url": `${SITE_URL}/services/${service.slug}`,
    "image": service.image.src,
    "serviceType": "Barbershop",
    "provider": {
      "@type": "BarberShop",
      "name": "Gangster Barber",
      "url": SITE_URL,
      "telephone": "+263785139533",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Senga, Nehosho",
        "addressLocality": "Gweru",
        "addressRegion": "Midlands Province",
        "addressCountry": "ZW",
      },
    },
    "areaServed": {
      "@type": "City",
      "name": "Gweru",
    },
    "offers": {
      "@type": "Offer",
      "price": priceValue,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": `${SITE_URL}/book`,
    },
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      {/* Hero with image */}
      <section className="pt-28 md:pt-32 pb-10 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/services"
            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-red-600 transition-colors"
          >
            ← All Services
          </Link>
        </div>

        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-[2rem] overflow-hidden border border-white/10">
          <Image
            src={service.image.src}
            alt={service.image.alt}
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
            <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-3 block">
              {service.tagline}
            </span>
            <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-black tracking-tighter uppercase leading-[0.9]">
              {service.name}
              <span className="text-red-600">.</span>
            </h1>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="py-12 px-6 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-[1fr_auto] gap-12 items-start">
          <div>
            <p className="text-gray-300 text-base md:text-lg leading-relaxed font-medium mb-10">
              {service.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-10">
              {service.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-white/5 border border-white/5 rounded-full text-white/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <aside className="md:sticky md:top-32 bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 min-w-[260px]">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Price</p>
            <p className="text-5xl font-black italic text-red-600 mb-6">{service.price}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Duration</p>
            <p className="text-xl font-black text-white mb-8">{service.duration}</p>
            <Link
              href="/book"
              className="block w-full text-center px-8 py-4 bg-white text-black text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all"
            >
              Book {service.name}
            </Link>
            <p className="text-[8px] text-center font-bold uppercase tracking-widest text-white/20 mt-4">
              Or walk in — Mon–Sun 7am–7pm
            </p>
          </aside>
        </div>
      </section>

      {/* Related services */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-10">
          Other Services
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {services
            .filter((s) => s.slug !== service.slug)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/services/${other.slug}`}
                className="group block bg-white/[0.02] border border-white/5 rounded-[1.5rem] overflow-hidden hover:border-white/20 transition-all"
              >
                <div className="relative w-full aspect-[4/3]">
                  <Image
                    src={other.image.src}
                    alt={other.image.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] text-red-600 mb-2">
                    {other.tagline}
                  </p>
                  <h3 className="text-lg font-black uppercase tracking-tighter">
                    {other.name}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-2">
                    {other.price} · {other.duration}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
