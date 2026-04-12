"use client";

import React from "react";

/**
 * 🛰️ LocalBusinessSchema
 * Strategic SEO Component: Injects tactical structured data for search engines.
 * Optimized for Gweru, Zimbabwe local discovery.
 */
export const LocalBusinessSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    "name": "Gangster Barber",
    "image": "http://localhost:3005/logo.png",
    "@id": "http://localhost:3005",
    "url": "http://localhost:3005",
    "telephone": "+263777777777",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Senga / Nehosho",
      "addressLocality": "Gweru",
      "addressRegion": "Midlands",
      "addressCountry": "ZW"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -19.4527,
      "longitude": 29.8191
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "05:00",
        "closes": "22:00"
      }
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
