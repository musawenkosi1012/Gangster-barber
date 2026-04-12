"use client";

import React from "react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gangsterbarber.com";

export const LocalBusinessSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    "name": "Gangster Barber",
    "description": "Gweru's premier barbershop in Senga, specialising in precision fades, tapers, lineups and beard grooming. Walk-ins welcome. Online booking available.",
    "image": `${SITE_URL}/logo.png`,
    "@id": SITE_URL,
    "url": SITE_URL,
    "telephone": process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+263777777777",
    "priceRange": "$",
    "currenciesAccepted": "USD, ZWG",
    "paymentAccepted": "Cash, EcoCash, OneMoney, InnBucks",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Senga",
      "addressLocality": "Gweru",
      "addressRegion": "Midlands Province",
      "addressCountry": "ZW"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -19.4527,
      "longitude": 29.8191
    },
    "hasMap": "https://maps.google.com/?q=Senga+Gweru+Zimbabwe",
    "areaServed": [
      { "@type": "City", "name": "Gweru" },
      { "@type": "AdministrativeArea", "name": "Midlands Province" }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "05:00",
        "closes": "22:00"
      }
    ],
    "makesOffer": [
      {
        "@type": "Offer",
        "name": "Taper Fade",
        "description": "Precision taper fade haircut",
        "priceCurrency": "USD",
        "areaServed": "Gweru, Zimbabwe"
      },
      {
        "@type": "Offer",
        "name": "Lineup & Shape-Up",
        "description": "Clean hairline lineup and shape-up",
        "priceCurrency": "USD",
        "areaServed": "Gweru, Zimbabwe"
      },
      {
        "@type": "Offer",
        "name": "Beard Sculpt",
        "description": "Full beard trim and sculpting",
        "priceCurrency": "USD",
        "areaServed": "Gweru, Zimbabwe"
      },
      {
        "@type": "Offer",
        "name": "The Full Gangster",
        "description": "Complete grooming package — cut, lineup, beard, and finish",
        "priceCurrency": "USD",
        "areaServed": "Gweru, Zimbabwe"
      }
    ],
    "amenityFeature": [
      { "@type": "LocationFeatureSpecification", "name": "Online Booking", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Walk-ins Welcome", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "EcoCash Accepted", "value": true }
    ],
    "sameAs": [
      "https://facebook.com/gangsterbarber",
      "https://instagram.com/gangsterbarber"
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
