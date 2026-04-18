import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceDetailClient from "@/components/pages/ServiceDetailClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `Barber Service in Gweru | Gangster Barber`,
    description: "Premium barbershop service in Gweru, Zimbabwe. Book your appointment online.",
    alternates: {
      canonical: `${SITE_URL}/services/${slug}`,
    },
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Gangster Barber Service",
    "description": "Premium barbershop service in Gweru",
    "url": `${SITE_URL}/services/${slug}`,
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

      <ServiceDetailClient slug={slug} />

      <Footer />
    </main>
  );
}
