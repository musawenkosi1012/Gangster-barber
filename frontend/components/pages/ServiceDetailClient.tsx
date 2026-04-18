"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { transformAssetUrl } from "@/utils/cdn";

interface ServiceImage {
  id: number;
  image_path: string;
  alt_text: string | null;
  sort_order: number;
}

interface Service {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  images: ServiceImage[];
  is_active: boolean;
  category: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";

export default function ServiceDetailClient({ slug }: { slug: string }) {
  const [service, setService] = useState<Service | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/services`);
        if (res.ok) {
          const data = await res.json();
          setAllServices(data);
          const found = data.find((s: Service) => s.slug === slug);
          setService(found || null);
        }
      } catch (error) {
        console.error("Failed to fetch services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </div>;
  }

  if (!service) {
    notFound();
  }

  const primaryImage = service.images && service.images.length > 0 ? service.images[0] : null;
  const otherServices = allServices.filter(s => s.slug !== service.slug).slice(0, 3);

  return (
    <>
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
          {primaryImage ? (
            <Image
              src={transformAssetUrl(primaryImage.image_path, 1200, 576)}
              alt={primaryImage.alt_text || service.name}
              fill
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600/20 to-black/50 flex items-center justify-center">
              <span className="text-white/40">No image available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
            <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-3 block">
              {service.category || "Service"}
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
              {service.description || "Premium grooming service"}
            </p>

            {service.images && service.images.length > 1 && (
              <div className="mb-10">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-4">
                  Service Gallery ({service.images.length} photos)
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {service.images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                      <Image
                        src={transformAssetUrl(img.image_path, 200, 200)}
                        alt={img.alt_text || service.name}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="md:sticky md:top-32 bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 min-w-[260px]">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Price</p>
            <p className="text-5xl font-black italic text-red-600 mb-6">${service.price.toFixed(2)}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Duration</p>
            <p className="text-xl font-black text-white mb-8">{service.duration_minutes} minutes</p>
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
      {otherServices.length > 0 && (
        <section className="py-16 px-6 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-10">
            Other Services
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {otherServices.map((other) => {
              const otherPrimaryImage = other.images && other.images.length > 0 ? other.images[0] : null;
              return (
                <Link
                  key={other.slug}
                  href={`/services/${other.slug}`}
                  className="group block bg-white/[0.02] border border-white/5 rounded-[1.5rem] overflow-hidden hover:border-white/20 transition-all"
                >
                  <div className="relative w-full aspect-[4/3]">
                    {otherPrimaryImage ? (
                      <Image
                        src={transformAssetUrl(otherPrimaryImage.image_path, 400, 300)}
                        alt={otherPrimaryImage.alt_text || other.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600/20 to-black/50 flex items-center justify-center">
                        <span className="text-white/30 text-xs">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-red-600 mb-2">
                      {other.category || "Service"}
                    </p>
                    <h3 className="text-lg font-black uppercase tracking-tighter">
                      {other.name}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-2">
                      ${other.price.toFixed(2)} · {other.duration_minutes}m
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
