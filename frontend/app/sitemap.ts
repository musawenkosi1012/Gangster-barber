import { MetadataRoute } from 'next';
import { services } from '@/data/services';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gangsterbarber.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const coreRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/services`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/book`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${SITE_URL}/services/${s.slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...coreRoutes, ...serviceRoutes];
}
