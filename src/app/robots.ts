import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/management/',
        '/api/',
        '/_next/',
        '/static/',
      ],
    },
    sitemap: 'https://erp-nexway.vercel.app/sitemap.xml',
  };
}
