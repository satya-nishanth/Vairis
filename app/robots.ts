import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thevairis.com'

export default function robots(): MetadataRoute.Robots {
  const isStaging =
    process.env.AZURE_ENV_NAME === 'staging' ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('staging') ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('azurecontainerapps.io') ||
    process.env.VERCEL_ENV === 'preview';

  if (isStaging) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account', '/checkout', '/cart'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
