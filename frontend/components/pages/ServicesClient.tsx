"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

export default function ServicesClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/services`);
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (error) {
        console.error("Failed to fetch services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-6 max-w-5xl mx-auto space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-80 bg-white/[0.02] border border-white/5 rounded-[2.5rem] animate-pulse" />
        ))}
      </section>
    );
  }

  return (
    <section className="py-20 px-6 max-w-5xl mx-auto space-y-6">
      {services.map((service) => {
        const primaryImage = service.images && service.images.length > 0 ? service.images[0] : null;
        const priceFormatted = `$${service.price.toFixed(2)}`;

        return (
          <Link
            key={service.slug}
            href={`/services/${service.slug}`}
            className="block group"
          >
            <article className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6 md:p-10 group-hover:bg-white/[0.04] group-hover:border-white/10 transition-all">
              <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-10">
                {/* Image Container */}
                <div className="relative w-full md:w-72 h-48 md:h-auto shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-red-600/20 to-black/50 flex items-center justify-center">
                  {primaryImage ? (
                    <Image
                      src={transformAssetUrl(primaryImage.image_path, 288, 320)}
                      alt={primaryImage.alt_text || service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 288px"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      onError={() => console.error(`Failed to load image for ${service.name}`)}
                    />
                  ) : (
                    <span className="text-white/40 text-sm font-bold">No Image</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600 mb-3 block">
                      {service.category || "Service"}
                    </span>
                    <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4">
                      {service.name}
                    </h2>
                    <p className="text-gray-400 leading-relaxed font-medium mb-6 max-w-2xl">
                      {service.description || "Premium grooming service"}
                    </p>
                    {service.images && service.images.length > 1 && (
                      <div className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-4">
                        {service.images.length} photos available
                      </div>
                    )}
                  </div>

                  {/* Price & CTA */}
                  <div className="shrink-0 text-right">
                    <p className="text-3xl md:text-4xl font-black italic text-red-600">
                      {priceFormatted}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">
                      {service.duration_minutes} mins
                    </p>
                    <span className="mt-6 inline-block px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl group-hover:bg-red-600 group-hover:text-white transition-all">
                      View Details
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </Link>
        );
      })}
    </section>
  );
}
