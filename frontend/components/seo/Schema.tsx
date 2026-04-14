import React from "react";

const SITE_URL = "https://gangsterbarber.com";
const PHONE = "+263773772047";
const INSTAGRAM = "https://instagram.com/sukaravtech";

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "BarberShop",
  "@id": `${SITE_URL}/#barbershop`,
  "name": "Gangster Barber",
  "alternateName": ["Gangster Barber Gweru", "Gangster Barber Senga"],
  "description": "Gweru's #1 barbershop in Senga, Nehosho. Precision fades, taper fades, lineups, beard sculpts and full grooming packages. Walk-ins welcome, online booking available. Serving Gweru, Midlands Province, Zimbabwe.",
  "image": [
    `${SITE_URL}/logo.png`,
    `${SITE_URL}/og-image.jpg`,
  ],
  "url": SITE_URL,
  "telephone": PHONE,
  "email": "Gangsterbarbermobilebarber@gmail.com",
  "priceRange": "$",
  "currenciesAccepted": "USD, ZWG",
  "paymentAccepted": "Cash, EcoCash, OneMoney, InnBucks, O'Mari",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Senga, Nehosho",
    "addressLocality": "Gweru",
    "addressRegion": "Midlands Province",
    "postalCode": "",
    "addressCountry": "ZW"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -19.4527,
    "longitude": 29.8191
  },
  "hasMap": "https://maps.google.com/?q=Senga+Nehosho+Gweru+Zimbabwe",
  "areaServed": [
    { "@type": "City", "name": "Gweru" },
    { "@type": "Neighborhood", "name": "Senga" },
    { "@type": "Neighborhood", "name": "Nehosho" },
    { "@type": "AdministrativeArea", "name": "Midlands Province" },
    { "@type": "Country", "name": "Zimbabwe" }
  ],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
      ],
      "opens": "07:00",
      "closes": "19:00"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5.0",
    "reviewCount": "47",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Tapiwa M." },
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "reviewBody": "Best barber in Gweru by far. The taper fade was immaculate, exactly what I wanted. Will definitely be coming back."
    },
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Blessing C." },
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "reviewBody": "Clean shop, professional service and the lineup was razor sharp. Gangster Barber is the real deal in Senga."
    }
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Barbershop Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Taper Fade",
          "description": "Clean, smooth taper fade blended to perfection. Tailored to your face shape. Gweru's freshest cut.",
          "serviceType": "Haircut"
        },
        "priceCurrency": "USD",
        "price": "2.00",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Lineup & Shape-Up",
          "description": "Precision razor lineup, edge-up and hairline detailing.",
          "serviceType": "Haircut"
        },
        "priceCurrency": "USD",
        "price": "2.00",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Beard Sculpt",
          "description": "Full beard trim, sculpting and detailing.",
          "serviceType": "BeardGrooming"
        },
        "priceCurrency": "USD",
        "price": "2.00",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "The Full Gangster",
          "description": "Complete grooming package — haircut, beard trim, lineup and finish. Gweru's finest all-in-one session.",
          "serviceType": "FullGrooming"
        },
        "priceCurrency": "USD",
        "price": "5.00",
        "availability": "https://schema.org/InStock"
      }
    ]
  },
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "Online Booking", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Walk-ins Welcome", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "EcoCash Accepted", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "OneMoney Accepted", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "InnBucks Accepted", "value": true }
  ],
  "sameAs": [
    INSTAGRAM,
    "https://tiktok.com/@gangsterbarber",
    `https://wa.me/${PHONE.replace("+", "")}`
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${SITE_URL}/book`,
      "actionPlatform": [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform"
      ]
    },
    "result": {
      "@type": "Reservation",
      "name": "Haircut Booking"
    }
  }
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  "url": SITE_URL,
  "name": "Gangster Barber",
  "description": "Gweru's #1 barbershop — precision fades, tapers, lineups and beard sculpts in Senga, Zimbabwe.",
  "inLanguage": "en-ZW",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${SITE_URL}/book?service={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Where is Gangster Barber located in Gweru?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gangster Barber is located in Senga, Nehosho, Gweru, Zimbabwe. We are open Monday to Sunday from 7am to 7pm. Walk-ins are welcome and you can also book online at gangsterbarber.com/book."
      }
    },
    {
      "@type": "Question",
      "name": "How much does a haircut cost at Gangster Barber?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Haircuts at Gangster Barber start from just $2 USD. We offer taper fades, lineups, beard sculpts and full grooming packages. All prices are affordable and transparent. Payment accepted via cash, EcoCash, OneMoney and InnBucks."
      }
    },
    {
      "@type": "Question",
      "name": "Can I book a haircut online at Gangster Barber?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! You can book your session online at gangsterbarber.com/book. Choose your service, pick a time slot and pay online using EcoCash, OneMoney, InnBucks or cash on arrival. Appointments are preferred but walk-ins are always welcome."
      }
    },
    {
      "@type": "Question",
      "name": "What haircut services does Gangster Barber offer?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gangster Barber offers taper fades, skin fades, lineup & shape-ups, beard sculpts, beard trims, and The Full Gangster — a complete grooming package that includes a haircut, lineup, beard trim and finish. We specialise in precision fades and clean lineups."
      }
    },
    {
      "@type": "Question",
      "name": "What are Gangster Barber's opening hours?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gangster Barber is open Monday to Sunday, 7am to 7pm — including weekends. We are located in Senga, Nehosho, Gweru. You can also reach us on WhatsApp at +263 773 772 047."
      }
    },
    {
      "@type": "Question",
      "name": "Does Gangster Barber accept EcoCash?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Gangster Barber accepts EcoCash, OneMoney, InnBucks, O'Mari and cash. You can also pay online when booking through our website at gangsterbarber.com."
      }
    },
    {
      "@type": "Question",
      "name": "Is Gangster Barber the best barber in Gweru?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gangster Barber is Gweru's top-rated barbershop, known for precision fades, sharp lineups and professional grooming. Located in Senga, we serve clients from across Gweru, Midlands Province and Zimbabwe. Book online or walk in any day of the week."
      }
    }
  ]
};

export const LocalBusinessSchema = () => (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  </>
);
