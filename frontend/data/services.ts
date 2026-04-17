/**
 * Single source of truth for barber services.
 * Consumed by:
 *   - app/services/page.tsx           (list)
 *   - app/services/[slug]/page.tsx    (detail)
 *   - app/sitemap.ts                  (SEO sitemap)
 *   - scripts/indexnow.mjs            (duplicates the slugs inline — keep in sync)
 *
 * Service images are curated Unsplash URLs (host allowlisted in next.config.ts
 * remotePatterns). Replace with real shop photos via the admin upload flow or
 * by editing this file directly.
 */

export type ServiceImage = {
  src: string;
  alt: string;
};

export type Service = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: string;
  duration: string;
  tags: string[];
  image: ServiceImage;
};

export const services: Service[] = [
  {
    name: "Taper Fade",
    slug: "taper-fade",
    tagline: "The Freshest Cut in Gweru",
    description:
      "Clean, smooth taper fade blended to perfection. Whether you want a low, mid or high taper — we tailor every fade to your face shape and hair texture. The go-to cut for Gweru's sharpest guys.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Low fade", "Mid fade", "High fade", "Skin fade", "Taper haircut Gweru"],
    image: {
      src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=1200",
      alt: "Taper Fade at Gangster Barber Gweru — The Freshest Cut in Gweru",
    },
  },
  {
    name: "Lineup & Shape-Up",
    slug: "lineup-shape-up",
    tagline: "Razor Sharp. Every Time.",
    description:
      "Precision razor lineup, edge-up and hairline detailing. We carve a clean, defined hairline that frames your face perfectly. Walk in rough, walk out looking like a million dollars.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Hairline lineup", "Edge-up", "Shape-up Gweru", "Razor lineup"],
    image: {
      src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=1200",
      alt: "Lineup & Shape-Up at Gangster Barber Gweru — Razor Sharp. Every Time.",
    },
  },
  {
    name: "Beard Sculpt",
    slug: "beard-sculpt",
    tagline: "Groomed to Perfection.",
    description:
      "Full beard trim, sculpting and detailing. We shape, define and clean up your beard for a polished, professional look. From stubble shaping to full beard styling.",
    price: "From $2",
    duration: "40 mins",
    tags: ["Beard trim Gweru", "Beard sculpt", "Beard grooming", "Facial hair"],
    image: {
      src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1200",
      alt: "Beard Sculpt at Gangster Barber Gweru — Groomed to Perfection.",
    },
  },
  {
    name: "The Full Gangster",
    slug: "full-gangster",
    tagline: "The Complete Package.",
    description:
      "Haircut, beard trim, lineup, and the works. Our flagship service — the complete grooming experience that covers everything from the top of your head to your jawline. Gweru's finest, all in one session.",
    price: "From $5",
    duration: "80 mins",
    tags: ["Full grooming Gweru", "Haircut and beard Gweru", "Complete barber package"],
    image: {
      src: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=1200",
      alt: "The Full Gangster at Gangster Barber Gweru — The Complete Package.",
    },
  },
];

/**
 * Convenience helper: look up a service by slug (used by /services/[slug]).
 */
export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
