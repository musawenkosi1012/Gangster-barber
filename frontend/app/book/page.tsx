import type { Metadata } from "next";
import BookClient from "@/components/pages/BookClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

export const metadata: Metadata = {
  title: "Book Your Appointment",
  description:
    "Book online at Gangster Barber in Senga, Gweru. Pick a service, date and slot — pay securely via EcoCash, OneMoney, InnBucks, O'Mari or cash on arrival. Instant confirmation.",
  keywords: [
    "book barber Gweru",
    "barber appointment Gweru",
    "online booking Gweru barber",
    "EcoCash barber Gweru",
    "OneMoney barber Gweru",
    "InnBucks barber Gweru",
    "haircut booking Senga",
  ],
  alternates: {
    canonical: `${SITE_URL}/book`,
  },
  openGraph: {
    title: "Book Your Appointment | Gangster Barber Gweru",
    description:
      "Pick a service, date and slot. Pay securely via EcoCash, OneMoney, InnBucks, O'Mari or cash. Instant confirmation at Gweru's #1 barbershop.",
    url: `${SITE_URL}/book`,
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 500,
        height: 500,
        alt: "Book your appointment at Gangster Barber Gweru",
      },
    ],
  },
};

export default function BookPage() {
  return <BookClient />;
}
