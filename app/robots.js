// robots.txt — SEO
export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/admin', '/dashboard', '/wallet'] },
    ],
    sitemap: 'https://www.mzazi.shop/sitemap.xml',
  };
}
