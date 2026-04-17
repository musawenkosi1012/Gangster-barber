import type { Metadata } from "next";
import HomeClient from "@/components/pages/HomeClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

export const metadata: Metadata = {
  // Use the default layout title (don't override) so this page surfaces as
  // "Gangster Barber | #1 Barbershop in Gweru, Zimbabwe" in search results.
  description:
    "Gweru's top barbershop in Senga. Precision taper fades, skin fades, lineups, beard sculpts and full grooming packages from $2. Walk-ins welcome. Book online in under 2 minutes. Serving Senga, Nehosho & all of Midlands.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Gangster Barber | #1 Barbershop in Gweru, Zimbabwe",
    description:
      "Precision fades, tapers, lineups & beard sculpts in Senga, Gweru. Walk-ins welcome. Book your session online.",
    url: SITE_URL,
    siteName: "Gangster Barber",
    locale: "en_ZW",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 500,
        height: 500,
        alt: "Gangster Barber — Gweru's #1 Barbershop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gangster Barber | Gweru's #1 Barbershop",
    description: "Precision fades, tapers & grooming in Senga, Gweru, Zimbabwe. Book online.",
    images: ["/logo.png"],
  },
};

export default function HomePage() {
  return <HomeClient />;
}
